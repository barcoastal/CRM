/**
 * Send a deal's routed contract packet for signature. Auto-routes (Coastal +
 * processor + legal), fills each template with the deal's data, merges into one
 * PDF, detects signature anchors (\s\ \i\ \d\ \n\ \t\), creates a template-less
 * Envelope with those signing boxes, and emails the signer one signing link.
 *
 *   POST /api/contracts/packet/send
 *     body: { opportunityId, signerName, signerEmail, signerPhone?, documentName? }
 */
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { saveEnvelopePdf } from "@/lib/esign/storage";
import { renderSignRequestHtml, sendESignEmail } from "@/lib/esign/send-email";
import { buildContractData } from "@/lib/contracts/merge-data";
import { fillPacketToPdf } from "@/lib/contracts/docx-merge";
import { planPacket, loadPacketTemplates } from "@/lib/contracts/routing";
import { prepareAnchoredPacket } from "@/lib/contracts/anchors";

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const body = (await request.json().catch(() => ({}))) as {
    opportunityId?: string;
    signerName?: string;
    signerEmail?: string;
    signerPhone?: string;
    documentName?: string;
  };

  const opportunityId = body.opportunityId?.trim();
  const signerName = body.signerName?.trim();
  const signerEmail = body.signerEmail?.trim();
  if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  if (!signerName) return NextResponse.json({ error: "signerName required" }, { status: 400 });
  if (!signerEmail) return NextResponse.json({ error: "signerEmail required" }, { status: 400 });

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, accountId: true },
  });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const sender = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  // Route + fill + merge + detect anchors.
  let prepared: Awaited<ReturnType<typeof prepareAnchoredPacket>>;
  let plan: Awaited<ReturnType<typeof planPacket>>;
  let pageCount = 0;
  try {
    plan = await planPacket(opportunityId);
    const templates = await loadPacketTemplates(plan);
    const data = await buildContractData(opportunityId);
    const merged = await fillPacketToPdf(templates, data);
    prepared = await prepareAnchoredPacket(merged);
    pageCount = (await PDFDocument.load(prepared.pdf)).getPageCount();
  } catch (e) {
    // Surface the real reason (e.g. "Missing template(s): PROCESSOR_SAS, ...").
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build packet" },
      { status: 400 },
    );
  }

  if (prepared.signatureBoxes.length === 0) {
    return NextResponse.json(
      { error: "No signature anchors found. Add \\s\\ (and \\d\\, \\n\\) tokens to your Word templates where the client signs." },
      { status: 400 },
    );
  }

  const documentName = body.documentName?.trim() || `Coastal Debt Agreement Packet (${plan.processor} + ${plan.legal})`;

  const now = new Date();
  const envelope = await prisma.envelope.create({
    data: {
      opportunityId: opp.id,
      accountId: opp.accountId ?? null,
      recordType: "CONTRACT",
      status: "SENT",
      sentAt: now,
      signerName,
      signerEmail,
      signerPhone: body.signerPhone?.trim() || null,
      templateName: `Packet: Coastal + ${plan.processor} + ${plan.legal}`,
      documentName,
      pages: pageCount,
      // Round-trip to strip undefined so the value is valid Prisma JSON.
      signatureBoxes: JSON.parse(JSON.stringify(prepared.signatureBoxes)),
      initialBoxes: JSON.parse(JSON.stringify(prepared.initialBoxes)),
      dateBoxes: JSON.parse(JSON.stringify(prepared.dateBoxes)),
      textBoxes: JSON.parse(JSON.stringify(prepared.textBoxes)),
      createdById: session.userId,
    },
  });

  const preparedPdfPath = await saveEnvelopePdf(prepared.pdf, envelope.id);
  await prisma.envelope.update({ where: { id: envelope.id }, data: { preparedPdfPath } });

  await prisma.envelopeEvent.createMany({
    data: [
      { envelopeId: envelope.id, eventType: "CREATED", details: `Packet: Coastal + ${plan.processor} + ${plan.legal}` },
      { envelopeId: envelope.id, eventType: "SENT", details: `To ${signerEmail}` },
    ],
  });

  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const fromAddress = sender?.email ? `${sender.name ?? sender.email} <${sender.email}>` : defaultFrom;
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
      data: { envelopeId: envelope.id, eventType: "SENT", details: `Email send failed: ${emailRes.error ?? "unknown"}` },
    });
  }

  await auditWrite({
    userId: session.userId,
    entity: "Envelope",
    entityId: envelope.id,
    action: "CREATE",
    after: { opportunityId: opp.id, packet: plan.categories, signerEmail, documentName, emailSent: emailRes.ok },
  });

  return NextResponse.json({
    ok: true,
    envelopeId: envelope.id,
    signingToken: envelope.signingToken,
    signingUrl,
    packet: `Coastal + ${plan.processor} + ${plan.legal}`,
    pages: pageCount,
    signatureCount: prepared.signatureBoxes.length,
    emailSent: emailRes.ok,
    emailError: emailRes.ok ? null : emailRes.error ?? null,
  });
}
