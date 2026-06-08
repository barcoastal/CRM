import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

/**
 * Personal feed: posts from
 *  - all groups the user is a member of
 *  - all records the user follows
 * Newest-first, paginated by cursor.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 100);
  const cursor = url.searchParams.get("cursor");

  const [memberRows, followRows] = await Promise.all([
    prisma.chatterMember.findMany({
      where: { userId: session.userId },
      select: { groupId: true },
    }),
    prisma.chatterFollow.findMany({
      where: { userId: session.userId },
      select: { groupId: true, entityType: true, entityId: true },
    }),
  ]);

  const memberGroupIds = memberRows.map((m) => m.groupId);
  const followedGroupIds = followRows.filter((f) => f.groupId).map((f) => f.groupId!);
  const allGroupIds = Array.from(new Set([...memberGroupIds, ...followedGroupIds]));

  const recordFollows = followRows.filter((f) => f.entityType && f.entityId) as {
    entityType: string;
    entityId: string;
  }[];

  const orConditions: Record<string, unknown>[] = [];
  if (allGroupIds.length > 0) {
    orConditions.push({ groupId: { in: allGroupIds } });
  }
  for (const f of recordFollows) {
    orConditions.push({ entityType: f.entityType, entityId: f.entityId });
  }

  if (orConditions.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const posts = await prisma.chatterPost.findMany({
    where: { parentId: null, OR: orConditions },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      group: { select: { id: true, name: true } },
      reactions: { select: { id: true, userId: true, emoji: true } },
      _count: { select: { replies: true } },
    },
  });

  return NextResponse.json({
    items: posts,
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  });
}
