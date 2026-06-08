/**
 * Authenticated Void endpoint. The operator (sender) withdraws an envelope
 * before completion. Sends a "document withdrawn" notice to the signer and a
 * confirmation back to the sender, then moves the envelope to VOIDED.
 *
 *   POST /api/esign/envelopes/:id/void
 *     body: { reason?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { renderEnvelopeTerminatedHtml, sendESignEmail } from "@/lib/esign/send-email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim() || "Withdrawn by sender";

  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (envelope.status === "COMPLETED" || envelope.status === "VOIDED" || envelope.status === "DECLINED") {
    return NextResponse.json(
      { error: `Envelope is ${envelope.status} and cannot be voided.` },
      { status: 400 },
    );
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: "VOIDED", voidedAt: now, voidReason: reason },
    }),
    prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "VOIDED",
        details: reason,
      },
    }),
  ]);

  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const senderEmail = envelope.createdBy?.email ?? null;
  const fromAddress = senderEmail
    ? `${envelope.createdBy?.name ?? senderEmail} <${senderEmail}>`
    : defaultFrom;

  try {
    const signerRes = await sendESignEmail({
      from: fromAddress,
      to: envelope.signerEmail,
      subject: `Document withdrawn: ${envelope.documentName}`,
      html: renderEnvelopeTerminatedHtml({
        signerName: envelope.signerName,
        documentName: envelope.documentName,
        reason,
        voided: true,
      }),
      replyTo: senderEmail,
    });
    if (!signerRes.ok) {
      await prisma.envelopeEvent.create({
        data: {
          envelopeId: envelope.id,
          eventType: "EMAIL_FAILED",
          details: `Signer void notice: ${signerRes.error ?? "unknown"}`,
        },
      });
    }
  } catch (e) {
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "EMAIL_FAILED",
        details: `Signer void notice threw: ${e instanceof Error ? e.message : String(e)}`,
      },
    });
  }

  if (senderEmail) {
    try {
      await sendESignEmail({
        from: defaultFrom,
        to: senderEmail,
        subject: `Envelope voided: ${envelope.documentName}`,
        html: renderEnvelopeTerminatedHtml({
          signerName: envelope.createdBy?.name ?? "team",
          documentName: envelope.documentName,
          reason: `You voided this envelope. ${reason}`,
          voided: true,
        }),
      });
    } catch {
      // best-effort
    }
  }

  await auditWrite({
    userId: session.userId,
    entity: "Envelope",
    entityId: envelope.id,
    action: "UPDATE",
    after: { status: "VOIDED", voidReason: reason },
  });

  return NextResponse.json({ ok: true });
}
