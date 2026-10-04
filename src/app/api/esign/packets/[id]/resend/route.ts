import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePacketAuth } from "@/lib/esign/salesforce/embed";
import { deliverPacketInvitation } from "@/lib/esign/packet-routing";
export async function POST(req: NextRequest, c: { params: Promise<{ id: string }> }) {
  const { id } = await c.params;
  const auth = await requirePacketAuth(req, id, "Opportunity.Edit");
  if ("response" in auth) return auth.response;
  const claim = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const packet = await tx.signingPacket.findFirst({ where: { id, createdById: auth.session.userId, status: "SENT" } });
    if (!packet) return null;
    const envelope = await tx.envelope.findFirst({ where: { packetId: id, status: { in: ["SENT", "VIEWED"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { routingOrder: "asc" } });
    if (!envelope) return null;
    const recent = await tx.envelopeEvent.findFirst({ where: { envelopeId: envelope.id, eventType: "RESEND_REQUESTED", createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent) return { limited: true } as const;
    const key = `resend-${envelope.id}-${randomUUID()}`;
    await tx.envelopeEvent.create({ data: { envelopeId: envelope.id, eventType: "RESEND_REQUESTED", details: JSON.stringify({ userId: auth.session.userId, key }) } });
    return { envelopeId: envelope.id, key };
  });
  if (!claim) return NextResponse.json({ error: "Only an active, unexpired signing invitation can be resent." }, { status: 409 });
  if ("limited" in claim) return NextResponse.json({ error: "Please wait one minute before resending again." }, { status: 429 });
  const result = await deliverPacketInvitation(claim.envelopeId, claim.key, true);
  return NextResponse.json(result.ok ? { ok: true } : { error: "Invitation delivery failed. Please try again in one minute." }, { status: result.ok ? 200 : 502 });
}
