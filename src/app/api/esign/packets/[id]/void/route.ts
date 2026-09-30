import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const a = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in a) return a.response;
  const { id } = await c.params;
  const body = await req.json().catch(() => null);
  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!reason)
    return NextResponse.json(
      { error: "Enter a reason for voiding." },
      { status: 400 },
    );
  const ok = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const p = await tx.signingPacket.findFirst({
      where: {
        id,
        createdById: a.session.userId,
        status: { in: ["DRAFT", "SENT", "SENDING"] },
      },
    });
    if (!p) return false;
    const envelopes = await tx.envelope.findMany({
      where: { packetId: id, status: { in: ["DRAFT", "SENT", "VIEWED"] } },
    });
    for (const e of envelopes) {
      const changed = await tx.envelope.updateMany({
        where: { id: e.id, status: { in: ["DRAFT", "SENT", "VIEWED"] } },
        data: { status: "VOIDED", voidReason: reason },
      });
      if (changed.count)
        await tx.envelopeEvent.create({
          data: {
            envelopeId: e.id,
            eventType: "VOIDED",
            details: JSON.stringify({ reason, userId: a.session.userId }),
          },
        });
    }
    await tx.signingPacket.update({
      where: { id },
      data: { status: "VOIDED" },
    });
    return true;
  });
  return NextResponse.json(
    ok ? { ok: true } : { error: "This packet cannot be voided." },
    { status: ok ? 200 : 409 },
  );
}
