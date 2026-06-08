/**
 * POST /api/notifications/[id]/archive
 * Marks one notification as archived (hidden from bell + list). 404 if not
 * owned by current user.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const { id } = await ctx.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.recipientId !== r.session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { archivedAt: new Date(), readAt: n.readAt ?? new Date() },
  });
  return NextResponse.json({ ok: true, notification: updated });
}
