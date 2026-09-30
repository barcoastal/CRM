import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { packetConfigSchema } from "@/lib/esign/packet-config";
type C = { params: Promise<{ id: string }> };
export async function GET(_r: NextRequest, c: C) {
  const a = await requireAuthOrRespond("Opportunity.View");
  if ("response" in a) return a.response;
  const { id } = await c.params;
  const p = await prisma.signingPacket.findFirst({
    where: { id, createdById: a.session.userId },
    include: {
      envelopes: {
        select: {
          id: true,
          status: true,
          signerName: true,
          signerEmail: true,
          routingOrder: true,
          sentAt: true,
          completedAt: true,
          lastError: true,
          expiresAt: true,
        },
      },
    },
  });
  return p
    ? NextResponse.json(p)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function PATCH(req: NextRequest, c: C) {
  const a = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in a) return a.response;
  const { id } = await c.params;
  const body = await req.json().catch(() => null);
  const parsed = packetConfigSchema.safeParse(body?.config);
  if (!parsed.success || !Number.isInteger(body?.revision))
    return NextResponse.json(
      { error: "Complete valid recipient and email details." },
      { status: 400 },
    );
  const p = await prisma.signingPacket.findFirst({
    where: { id, createdById: a.session.userId, status: "DRAFT" },
  });
  if (!p)
    return NextResponse.json({ error: "Draft not available" }, { status: 409 });
  const old = p.config as { documents: unknown };
  const changed = await prisma.signingPacket.updateMany({
    where: { id, revision: body.revision, status: "DRAFT" },
    data: {
      config: { ...parsed.data, documents: old.documents } as never,
      revision: { increment: 1 },
    },
  });
  return changed.count
    ? NextResponse.json({ revision: body.revision + 1 })
    : NextResponse.json(
        { error: "Draft changed. Reload before editing." },
        { status: 409 },
      );
}
