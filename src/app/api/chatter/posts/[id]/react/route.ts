import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ALLOWED_EMOJI = new Set(["like", "love", "laugh", "celebrate", "insightful", "support"]);

const schema = z.object({ emoji: z.string().min(1).max(32) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  if (!ALLOWED_EMOJI.has(parsed.data.emoji)) {
    return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 });
  }

  const post = await prisma.chatterPost.findUnique({ where: { id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Upsert: one reaction per user per post; calling again with the same
  // emoji removes it (toggle off).
  const existing = await prisma.chatterReaction.findUnique({
    where: { postId_userId: { postId: id, userId: session.userId } },
  });

  if (existing && existing.emoji === parsed.data.emoji) {
    await prisma.chatterReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ removed: true });
  }

  const reaction = await prisma.chatterReaction.upsert({
    where: { postId_userId: { postId: id, userId: session.userId } },
    update: { emoji: parsed.data.emoji },
    create: { postId: id, userId: session.userId, emoji: parsed.data.emoji },
  });
  return NextResponse.json(reaction);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;
  await prisma.chatterReaction.deleteMany({
    where: { postId: id, userId: session.userId },
  });
  return NextResponse.json({ ok: true });
}
