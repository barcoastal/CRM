import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

async function callerCanManage(groupId: string, userId: string): Promise<boolean> {
  const group = await prisma.chatterGroup.findUnique({
    where: { id: groupId },
    select: { ownerId: true },
  });
  if (!group) return false;
  if (group.ownerId === userId) return true;
  const m = await prisma.chatterMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  return m?.role === "manager" || m?.role === "owner";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const { id } = await ctx.params;
  const members = await prisma.chatterMember.findMany({
    where: { groupId: id },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, isActive: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json({ items: members });
}

const addSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["member", "manager", "owner"]).default("member"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  // A member can join a public group themselves; otherwise need manager rights.
  const isSelf = parsed.data.userId === session.userId;
  const canManage = await callerCanManage(id, session.userId);
  if (!isSelf && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isSelf && !canManage) {
    const g = await prisma.chatterGroup.findUnique({ where: { id }, select: { visibility: true } });
    if (!g) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (g.visibility !== "public") {
      return NextResponse.json({ error: "Cannot self-join private group" }, { status: 403 });
    }
  }

  const member = await prisma.chatterMember.upsert({
    where: { groupId_userId: { groupId: id, userId: parsed.data.userId } },
    update: { role: parsed.data.role },
    create: { groupId: id, userId: parsed.data.userId, role: parsed.data.role },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const isSelf = targetUserId === session.userId;
  const canManage = await callerCanManage(id, session.userId);
  if (!isSelf && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chatterMember.deleteMany({
    where: { groupId: id, userId: targetUserId },
  });
  return NextResponse.json({ ok: true });
}
