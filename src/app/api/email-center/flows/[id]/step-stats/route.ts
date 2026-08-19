/**
 * GET /api/email-center/flows/[id]/step-stats
 *
 * Per-step live stats for the flow builder. For send_email steps: how many
 * this step has sent plus delivery/open/click. For wait steps: how many runs
 * are currently parked at that step (FlowRun WAITING with currentNodeId=step).
 *
 * Keyed by graph node id. The builder maps each node to its stats.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const [emailRows, waitingGroups] = await Promise.all([
    // Per-step email engagement. flowNodeId is written by the send_email node.
    prisma.emailMessage.findMany({
      where: { flowId: id, flowNodeId: { not: null }, direction: "OUTBOUND" },
      select: { flowNodeId: true, deliveredAt: true, openedAt: true, firstClickedAt: true },
      take: 50000,
    }),
    // Runs currently paused at a wait step.
    prisma.flowRun.groupBy({
      by: ["currentNodeId"],
      where: { flowId: id, status: "WAITING", currentNodeId: { not: null } },
      _count: true,
    }),
  ]);

  const emails: Record<string, { sent: number; delivered: number; opened: number; clicked: number; openRate: number; clickRate: number }> = {};
  for (const m of emailRows) {
    const nodeId = m.flowNodeId as string;
    const e = emails[nodeId] ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 };
    e.sent += 1;
    if (m.deliveredAt) e.delivered += 1;
    if (m.openedAt) e.opened += 1;
    if (m.firstClickedAt) e.clicked += 1;
    emails[nodeId] = e;
  }
  for (const nodeId of Object.keys(emails)) {
    const e = emails[nodeId];
    // Rate over delivered when we have delivery data, else over sent.
    const denom = e.delivered > 0 ? e.delivered : e.sent;
    e.openRate = pct(e.opened, denom);
    e.clickRate = pct(e.clicked, denom);
  }

  const waiting: Record<string, number> = {};
  for (const g of waitingGroups) {
    if (g.currentNodeId) waiting[g.currentNodeId] = g._count;
  }

  return NextResponse.json({ emails, waiting });
}
