import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { extractMentionIds } from "@/lib/chatter/mentions";

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const { id } = await ctx.params;
  const post = await prisma.chatterPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      group: { select: { id: true, name: true } },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, avatar: true } },
          reactions: { select: { id: true, userId: true, emoji: true } },
        },
      },
    },
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

const patchSchema = z.object({ body: z.string().min(1).max(10000) });

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

  const existing = await prisma.chatterPost.findUnique({
    where: { id },
    select: { id: true, authorId: true, createdAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.authorId !== session.userId) {
    return NextResponse.json({ error: "Only the author can edit this post" }, { status: 403 });
  }
  if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Edit window has expired (5 minutes)" }, { status: 403 });
  }

  const updated = await prisma.chatterPost.update({
    where: { id },
    data: {
      body: parsed.data.body,
      mentions: extractMentionIds(parsed.data.body),
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      reactions: { select: { id: true, userId: true, emoji: true } },
      _count: { select: { replies: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const post = await prisma.chatterPost.findUnique({
    where: { id },
    select: { id: true, authorId: true, groupId: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Author or group owner can delete.
  let allowed = post.authorId === session.userId;
  if (!allowed && post.groupId) {
    const g = await prisma.chatterGroup.findUnique({
      where: { id: post.groupId },
      select: { ownerId: true },
    });
    if (g?.ownerId === session.userId) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Only the author or group owner can delete this post" }, { status: 403 });
  }

  await prisma.chatterPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
