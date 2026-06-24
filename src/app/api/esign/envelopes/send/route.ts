/**
 * Send an envelope from a template + opportunity. This is the entry point for
 * the "Send Contract" button on the Opportunity detail page.
 *
 *   POST /api/esign/envelopes/send
 *     body: {
 *       opportunityId: string;
 *       templateId: string;
 *       signerName: string;
 *       signerEmail: string;
 *       signerPhone?: string;
 *       documentName?: string;      // override template.name
 *       recordType?: string;        // override template.recordType
 *     }
 *
 * Flow:
 *   1. Auth + load template + opp + sender user.
 *   2. Build merge context from opp/account/contact/lead/user/today.
 *   3. fillAcroForm on the template PDF.
 *   4. Create Envelope row (status=SENT, snapshot of template box arrays).
 *   5. Save merged PDF to envelopeDir() under preparedPdfPath.
 *   6. Log EnvelopeEvent(CREATED) + EnvelopeEvent(SENT).
 *   7. Email signer via Resend.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { readTemplatePdf, saveEnvelopePdf } from "@/lib/esign/storage";
import { buildMergeContextForOpportunity, fillAcroForm, stampDataBoxes } from "@/lib/esign/merge";
import { renderSignRequestHtml, sendESignEmail } from "@/lib/esign/send-email";
import { RECORD_TYPES } from "@/lib/esign/merge-paths";

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const body = (await request.json().catch(() => ({}))) as {
    opportunityId?: string;
    templateId?: string;
    signerName?: string;
    signerEmail?: string;
    signerPhone?: string;
    documentName?: string;
    recordType?: string;
  };

  const opportunityId = body.opportunityId?.trim();
  const templateId = body.templateId?.trim();
  const signerName = body.signerName?.trim();
  const signerEmail = body.signerEmail?.trim();

  if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });
  if (!signerName) return NextResponse.json({ error: "signerName required" }, { status: 400 });
  if (!signerEmail) return NextResponse.json({ error: "signerEmail required" }, { status: 400 });

  const template = await prisma.envelopeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!template.isActive) return NextResponse.json({ error: "Template inactive" }, { status: 400 });

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, accountId: true },
  });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const sender = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  // Build the merge context and run the AcroForm fill against the template PDF.
  let mergedPdf: Buffer;
  try {
    const ctx = await buildMergeContextForOpportunity(opportunityId, session.userId);
    const templateBuf = await readTemplatePdf(template.pdfPath);
    const mapping = (template.mergeMapping ?? {}) as Record<string, string>;
    mergedPdf = await fillAcroForm(templateBuf, mapping, ctx);
    // Stamp positioned CRM data fields (for PDFs without AcroForm fields).
    mergedPdf = await stampDataBoxes(
      mergedPdf,
      (template.dataBoxes ?? []) as unknown as Parameters<typeof stampDataBoxes>[1],
      ctx,
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to render PDF", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const recordType = body.recordType && (RECORD_TYPES as readonly string[]).includes(body.recordType)
    ? body.recordType
    : template.recordType;
  const documentName = body.documentName?.trim() || template.name;

  const now = new Date();
  const envelope = await prisma.envelope.create({
    data: {
      templateId: template.id,
      opportunityId: opp.id,
      accountId: opp.accountId ?? null,
      leadId: null,
      recordType,
      status: "SENT",
      sentAt: now,
      signerName,
      signerEmail,
      signerPhone: body.signerPhone?.trim() || null,
      templateName: template.name,
      documentName,
      pages: template.pageCount,
      // Snapshot the box arrays so editing the template later does not break
      // an already-sent envelope.
      signatureBoxes: template.signatureBoxes ?? [],
      initialBoxes: template.initialBoxes ?? [],
      dateBoxes: template.dateBoxes ?? [],
      textBoxes: template.textBoxes ?? [],
      dataBoxes: template.dataBoxes ?? [],
      checkboxBoxes: template.checkboxBoxes ?? [],
      createdById: session.userId,
    },
  });

  const preparedPdfPath = await saveEnvelopePdf(mergedPdf, envelope.id);
  await prisma.envelope.update({
    where: { id: envelope.id },
    data: { preparedPdfPath },
  });

  await prisma.envelopeEvent.createMany({
    data: [
      { envelopeId: envelope.id, eventType: "CREATED", details: `From template ${template.name}` },
      { envelopeId: envelope.id, eventType: "SENT", details: `To ${signerEmail}` },
    ],
  });

  // Send signer email. Send-as-user pattern matches /api/emails/compose.
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const fromAddress = sender?.email
    ? `${sender.name ?? sender.email} <${sender.email}>`
    : defaultFrom;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
  const signingUrl = `${baseUrl.replace(/\/$/, "")}/sign/${envelope.signingToken}`;

  const emailRes = await sendESignEmail({
    from: fromAddress,
    to: signerEmail,
    subject: `Please sign: ${documentName}`,
    html: renderSignRequestHtml({
      signerName,
      senderName: sender?.name ?? null,
      senderEmail: sender?.email ?? null,
      documentName,
      signingUrl,
    }),
    replyTo: sender?.email ?? null,
  });

  if (!emailRes.ok) {
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "SENT",
        details: `Email send failed: ${emailRes.error ?? "unknown"}`,
      },
    });
  }

  await auditWrite({
    userId: session.userId,
    entity: "Envelope",
    entityId: envelope.id,
    action: "CREATE",
    after: {
      templateId: template.id,
      opportunityId: opp.id,
      signerEmail,
      documentName,
      emailSent: emailRes.ok,
    },
  });

  return NextResponse.json({
    ok: true,
    envelopeId: envelope.id,
    signingToken: envelope.signingToken,
    signingUrl,
    emailSent: emailRes.ok,
    emailError: emailRes.ok ? null : emailRes.error ?? null,
  });
}
