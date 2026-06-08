/**
 * Public decline endpoint. The signer can refuse to sign with a reason; the
 * envelope is moved to a terminal DECLINED state and the sender is notified.
 *
 *   POST /api/esign/envelopes/by-token/:token/decline
 *     body: { reason: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderEnvelopeTerminatedHtml, sendESignEmail } from "@/lib/esign/send-email";

function pickIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim() || "No reason provided";

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (envelope.status === "COMPLETED" || envelope.status === "VOIDED" || envelope.status === "DECLINED") {
    return NextResponse.json(
      { error: `Envelope is ${envelope.status} and cannot be declined.` },
      { status: 400 },
    );
  }

  const now = new Date();
  const ip = pickIp(request);
  const ua = request.headers.get("user-agent") ?? "";
  const voidReason = `Declined by signer: ${reason}`;

  await prisma.$transaction([
    prisma.envelope.update({
      where: { id: envelope.id },
      data: {
        status: "DECLINED",
        voidedAt: now,
        voidReason,
      },
    }),
    prisma.envelopeEvent.create({
      data: {
        envelopeId: envelope.id,
        eventType: "DECLINED",
        details: reason,
        ipAddress: ip || null,
        userAgent: ua || null,
      },
    }),
  ]);

  const senderEmail = envelope.createdBy?.email ?? null;
  if (senderEmail) {
    const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
    try {
      const res = await sendESignEmail({
        from: defaultFrom,
        to: senderEmail,
        subject: `${envelope.signerName} declined ${envelope.documentName}`,
        html: renderEnvelopeTerminatedHtml({
          signerName: envelope.createdBy?.name ?? "team",
          documentName: envelope.documentName,
          reason: `${envelope.signerName} (${envelope.signerEmail}) declined. ${reason}`,
          voided: false,
        }),
      });
      if (!res.ok) {
        await prisma.envelopeEvent.create({
          data: {
            envelopeId: envelope.id,
            eventType: "EMAIL_FAILED",
            details: `Decline notice: ${res.error ?? "unknown"}`,
          },
        });
      }
    } catch (e) {
      await prisma.envelopeEvent.create({
        data: {
          envelopeId: envelope.id,
          eventType: "EMAIL_FAILED",
          details: `Decline notice threw: ${e instanceof Error ? e.message : String(e)}`,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
