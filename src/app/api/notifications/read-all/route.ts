/**
 * POST /api/notifications/read-all
 * Marks every unread notification for the current user as read.
 * Returns { updated: N }.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const res = await prisma.notification.updateMany({
    where: { recipientId: r.session.userId, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: res.count });
}
