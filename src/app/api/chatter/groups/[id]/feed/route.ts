import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await ctx.params;

  const group = await prisma.chatterGroup.findUnique({
    where: { id },
    select: { id: true, visibility: true },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.visibility === "private") {
    const member = await prisma.chatterMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: session.userId } },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 100);
  const cursor = url.searchParams.get("cursor");

  const posts = await prisma.chatterPost.findMany({
    where: { groupId: id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      reactions: { select: { id: true, userId: true, emoji: true } },
      _count: { select: { replies: true } },
    },
  });

  return NextResponse.json({
    items: posts,
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  });
}
