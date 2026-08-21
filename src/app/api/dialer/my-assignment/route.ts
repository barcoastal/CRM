import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * The current fronter's latest closer assignment (last 30 min), so the dialer
 * can show "Transfer to [closer]" once the floor manager assigns one.
 */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const h = await prisma.closerHandoff.findFirst({
    where: { fronterId: r.session.userId, status: "ASSIGNED", assignedAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
    orderBy: { assignedAt: "desc" },
    include: { closer: { select: { name: true } } },
  });
  if (!h) return NextResponse.json({ assignment: null });
  return NextResponse.json({
    assignment: { id: h.id, closer: h.closer?.name ?? null, tier: h.tier, clientName: h.clientName, debtLabel: h.debtLabel, assignedAt: h.assignedAt },
  });
}
