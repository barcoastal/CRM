import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const group = await prisma.chatterGroup.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { members: true, posts: true } },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const myMember = await prisma.chatterMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.userId } },
    select: { role: true },
  });

  // Private group access: only members can see.
  if (group.visibility === "private" && !myMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Following state for this group.
  const follow = await prisma.chatterFollow.findFirst({
    where: { userId: session.userId, groupId: id, entityType: null, entityId: null },
    select: { id: true },
  });

  return NextResponse.json({
    ...group,
    myRole: myMember?.role ?? null,
    isMember: !!myMember,
    isFollowing: !!follow,
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.chatterGroup.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner or manager can edit.
  const member = await prisma.chatterMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.userId } },
    select: { role: true },
  });
  const isOwner = group.ownerId === session.userId;
  const isManager = member?.role === "manager" || member?.role === "owner";
  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.chatterGroup.update({
    where: { id },
    data: parsed.data,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, posts: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const group = await prisma.chatterGroup.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (group.ownerId !== session.userId) {
    return NextResponse.json({ error: "Only the owner can delete the group" }, { status: 403 });
  }

  await prisma.chatterGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
