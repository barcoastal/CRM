/**
 * Send a TEST envelope of this template to the logged-in user, so they can
 * preview/exercise the signing flow without a real opportunity. No
 * opportunity/account is attached and the merge context is empty (CRM data
 * fields render blank in a test), so nothing is written back to records.
 *
 *   POST /api/esign/templates/[id]/test-send
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readTemplatePdf, saveEnvelopePdf } from "@/lib/esign/storage";
import { fillAcroForm, stampDataBoxes, type MergeContext } from "@/lib/esign/merge";
import { renderSignRequestHtml, sendESignEmail } from "@/lib/esign/send-email";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await ctx.params;

  const template = await prisma.envelopeTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "Your account has no email to send the test to." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const mergeCtx: MergeContext = { today, user };

  let mergedPdf: Buffer;
  try {
    const templateBuf = await readTemplatePdf(template.pdfPath);
    const mapping = (template.mergeMapping ?? {}) as Record<string, string>;
    mergedPdf = await fillAcroForm(templateBuf, mapping, mergeCtx);
    mergedPdf = await stampDataBoxes(
      mergedPdf,
      (template.dataBoxes ?? []) as unknown as Parameters<typeof stampDataBoxes>[1],
      mergeCtx,
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to render PDF", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const documentName = `[TEST] ${template.name}`;
  const envelope = await prisma.envelope.create({
    data: {
      templateId: template.id,
      recordType: template.recordType,
      status: "SENT",
      sentAt: new Date(),
      signerName: user.name ?? user.email,
      signerEmail: user.email,
      templateName: template.name,
      documentName,
      pages: template.pageCount,
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
  await prisma.envelope.update({ where: { id: envelope.id }, data: { preparedPdfPath } });

  await prisma.envelopeEvent.createMany({
    data: [
      { envelopeId: envelope.id, eventType: "CREATED", details: `TEST from template ${template.name}` },
      { envelopeId: envelope.id, eventType: "SENT", details: `TEST to ${user.email}` },
    ],
  });

  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const fromAddress = `${user.name ?? user.email} <${user.email}>`;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
  const signingUrl = `${baseUrl.replace(/\/$/, "")}/sign/${envelope.signingToken}`;

  const emailRes = await sendESignEmail({
    from: fromAddress || defaultFrom,
    to: user.email,
    subject: `[TEST] Please sign: ${template.name}`,
    html: renderSignRequestHtml({
      signerName: user.name ?? user.email,
      senderName: user.name ?? null,
      senderEmail: user.email,
      documentName,
      signingUrl,
    }),
    replyTo: user.email,
  });

  return NextResponse.json({
    ok: true,
    envelopeId: envelope.id,
    signingUrl,
    emailSent: emailRes.ok,
    sentTo: user.email,
  });
}
