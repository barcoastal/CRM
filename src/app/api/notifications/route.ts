/**
 * GET /api/notifications
 *   Query: ?unreadOnly=1 (optional), ?take=N (default 20, max 100),
 *          ?cursor=<id> (optional, for "load more")
 *   Returns { notifications: [...], unreadCount: N, nextCursor: string|null }.
 *
 * All scoped to the current session user (recipientId == session.user.id).
 * Auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1" || url.searchParams.get("unreadOnly") === "true";
  const takeRaw = Number(url.searchParams.get("take") ?? "20");
  const take = Math.max(1, Math.min(100, Number.isFinite(takeRaw) ? Math.floor(takeRaw) : 20));
  const cursor = url.searchParams.get("cursor");
  const kind = url.searchParams.get("kind");

  const where: Record<string, unknown> = {
    recipientId: r.session.userId,
    archivedAt: null,
  };
  if (unreadOnly) where.readAt = null;
  if (kind) where.kind = kind;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  let nextCursor: string | null = null;
  if (notifications.length > take) {
    const next = notifications.pop()!;
    nextCursor = next.id;
  }

  const unreadCount = await prisma.notification.count({
    where: { recipientId: r.session.userId, readAt: null, archivedAt: null },
  });

  return NextResponse.json({ notifications, unreadCount, nextCursor });
}
