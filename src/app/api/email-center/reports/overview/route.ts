// src/app/api/email-center/reports/overview/route.ts
/**
 * GET /api/email-center/reports/overview?days=30&user=<id|all>&campaign=<id>&flow=<id>
 *
 * Returns headline rates, a daily send trend, and top clicked URLs for the
 * scope. Non-admins are locked to their own ownerId; admins may pass ?user=.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { computeRates, bucketByDay, topUrls, type MessageAgg } from "@/lib/email/reports";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "30"), 1), 365);
  const since = new Date(Date.now() - days * 864e5);
  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  const userParam = url.searchParams.get("user");
  const campaignId = url.searchParams.get("campaign");
  const flowId = url.searchParams.get("flow");

  // Ownership scope: non-admins locked to self; admins may target a user or all.
  let ownerId: string | undefined = r.session.userId;
  if (isAdmin) {
    if (userParam === "all" || !userParam) ownerId = undefined;
    else ownerId = userParam;
  }

  const msgWhere = {
    direction: "OUTBOUND",
    createdAt: { gte: since },
    ...(ownerId ? { ownerId } : {}),
    ...(campaignId ? { massEmailId: campaignId } : {}),
    ...(flowId ? { flowId } : {}),
  } as const;

  // Aggregate message-level analytics with grouped counts.
  const [total, delivered, uniqueOpens, uniqueClicks, byStatus, sendRows, clickRows] = await Promise.all([
    prisma.emailMessage.count({ where: msgWhere }),
    prisma.emailMessage.count({ where: { ...msgWhere, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, openedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, firstClickedAt: { not: null } } }),
    prisma.emailMessage.groupBy({ by: ["status"], where: msgWhere, _count: true }),
    prisma.emailMessage.findMany({ where: msgWhere, select: { createdAt: true }, take: 20000 }),
    // Click URLs: pull CLICK events in scope (denormalized fields make this cheap).
    prisma.emailEvent.findMany({
      where: {
        type: "CLICK",
        occurredAt: { gte: since },
        ...(ownerId ? { ownerId } : {}),
        ...(campaignId ? { massEmailId: campaignId } : {}),
        ...(flowId ? { flowId } : {}),
      },
      select: { url: true },
      take: 20000,
    }),
  ]);

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const unsubscribed = await prisma.emailEvent.count({
    where: {
      type: "UNSUBSCRIBE",
      occurredAt: { gte: since },
      ...(ownerId ? { ownerId } : {}),
      ...(campaignId ? { massEmailId: campaignId } : {}),
      ...(flowId ? { flowId } : {}),
    },
  });

  const agg: MessageAgg = {
    total,
    delivered,
    uniqueOpens,
    uniqueClicks,
    bounced: statusCount("BOUNCED"),
    complained: statusCount("COMPLAINED"),
    unsubscribed,
    failed: statusCount("FAILED"),
  };

  return NextResponse.json({
    days,
    scope: { ownerId: ownerId ?? "all", campaignId, flowId },
    totals: agg,
    rates: computeRates(agg),
    // sendRows have createdAt; map to occurredAt for bucketByDay.
    trend: bucketByDay(sendRows.map((row) => ({ occurredAt: row.createdAt }))),
    topUrls: topUrls(clickRows, 10),
  });
}
