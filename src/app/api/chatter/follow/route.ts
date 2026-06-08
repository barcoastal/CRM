import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const schema = z.object({
  groupId: z.string().cuid().optional(),
  entityType: z.string().min(1).max(64).optional(),
  entityId: z.string().min(1).max(64).optional(),
});

/** Toggle follow for a group OR for a (entityType+entityId) record. */
export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const hasGroup = !!d.groupId;
  const hasRecord = !!(d.entityType && d.entityId);
  if (hasGroup === hasRecord) {
    return NextResponse.json(
      { error: "Provide exactly one of groupId or (entityType + entityId)" },
      { status: 400 },
    );
  }

  const where = hasGroup
    ? { userId: session.userId, groupId: d.groupId!, entityType: null, entityId: null }
    : { userId: session.userId, groupId: null, entityType: d.entityType!, entityId: d.entityId! };

  const existing = await prisma.chatterFollow.findFirst({
    where: where as Record<string, unknown>,
    select: { id: true },
  });

  if (existing) {
    await prisma.chatterFollow.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  }

  await prisma.chatterFollow.create({
    data: {
      userId: session.userId,
      groupId: d.groupId ?? null,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
    },
  });
  return NextResponse.json({ following: true });
}

/** GET: am I following a target? */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const url = new URL(req.url);
  const groupId = url.searchParams.get("groupId");
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  const where = groupId
    ? { userId: session.userId, groupId, entityType: null, entityId: null }
    : { userId: session.userId, groupId: null, entityType, entityId };

  const f = await prisma.chatterFollow.findFirst({
    where: where as Record<string, unknown>,
    select: { id: true },
  });

  return NextResponse.json({ following: !!f });
}
