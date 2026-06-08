import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  // Visible groups: all public + private ones the user is a member of.
  const memberRows = await prisma.chatterMember.findMany({
    where: { userId: session.userId },
    select: { groupId: true, role: true },
  });
  const memberMap = new Map(memberRows.map((m) => [m.groupId, m.role]));

  const where: Record<string, unknown> = {
    OR: [
      { visibility: "public" },
      { id: { in: Array.from(memberMap.keys()) } },
    ],
  };
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const groups = await prisma.chatterGroup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  const enriched = groups.map((g) => ({
    ...g,
    myRole: memberMap.get(g.id) ?? null,
    isMember: memberMap.has(g.id),
  }));

  return NextResponse.json({ items: enriched });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  visibility: z.enum(["public", "private"]).default("public"),
  avatarUrl: z.string().url().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const group = await prisma.chatterGroup.create({
    data: {
      name: d.name,
      description: d.description ?? null,
      visibility: d.visibility,
      avatarUrl: d.avatarUrl ?? null,
      ownerId: session.userId,
      members: {
        create: { userId: session.userId, role: "owner" },
      },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, posts: true } },
    },
  });
  return NextResponse.json(group, { status: 201 });
}
