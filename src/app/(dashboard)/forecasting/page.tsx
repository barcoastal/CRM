import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABEL,
  defaultCategoryForStage,
  isForecastCategory,
  type ForecastCategory,
} from "@/lib/forecasting/categories";
import { currentMonthPeriod, currentQuarterPeriod, parsePeriod } from "@/lib/forecasting/period";
import { buildForecastRollup, summarizeRollup } from "@/lib/forecasting/rollup";
import { ForecastingClient } from "@/components/forecasting/forecasting-client";

void CATEGORY_LABEL; // re-exported for callers; reference here so TS doesn't warn.

export const dynamic = "force-dynamic";

export default async function ForecastingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; team?: string; forUserId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const currentUserId = session.user.id;
  const currentUserName = session.user.name ?? "Me";

  const sp = await searchParams;
  let period = sp.period?.trim() || currentMonthPeriod();
  let periodKind: "month" | "quarter" = "month";
  try {
    periodKind = parsePeriod(period).kind;
  } catch {
    period = currentMonthPeriod();
    periodKind = "month";
  }

  // Scope: defaults to current user + team. ALL = no user filter.
  const rawFor = sp.forUserId;
  const forUserId = rawFor === "ALL" ? null : rawFor || currentUserId;
  // includeTeam default true unless explicitly "0"
  const includeTeam = sp.team === undefined ? true : sp.team === "1" || sp.team === "true";

  const rows = await buildForecastRollup({ period, forUserId, includeTeam });
  const summary = summarizeRollup(rows);

  // Top pipeline movers: largest Commit + Best Case opps in the period.
  const { start, endExclusive } = parsePeriod(period);
  const userIdSet = new Set(rows.map((r) => r.userId));
  const oppCandidates = await prisma.opportunity.findMany({
    where: {
      assignedToId: userIdSet.size > 0 ? { in: Array.from(userIdSet) } : undefined,
      closeDate: { gte: start, lt: endExclusive },
    },
    select: {
      id: true,
      name: true,
      stage: true,
      forecastCategory: true,
      amount: true,
      totalDebt: true,
      closeDate: true,
      assignedTo: { select: { id: true, name: true } },
      account: { select: { name: true } },
    },
  });
  const enriched = oppCandidates
    .map((o) => {
      const explicit = o.forecastCategory;
      const category: ForecastCategory =
        explicit && isForecastCategory(explicit)
          ? (explicit as ForecastCategory)
          : defaultCategoryForStage(o.stage);
      const amount = typeof o.amount === "number" ? o.amount : typeof o.totalDebt === "number" ? o.totalDebt : 0;
      return {
        id: o.id,
        name: o.name ?? o.account?.name ?? "Opportunity",
        ownerName: o.assignedTo?.name ?? "Unassigned",
        amount,
        closeDate: o.closeDate ? o.closeDate.toISOString().slice(0, 10) : null,
        stage: o.stage,
        category,
      };
    })
    .filter((o) => o.category === "COMMIT" || o.category === "BEST_CASE")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // User picker options for the Set Quota modal: visible users (team scope or full org).
  const userPickerWhere =
    forUserId && includeTeam
      ? { id: { in: rows.map((r) => r.userId) } }
      : forUserId
        ? { id: forUserId }
        : { isActive: true };
  const users = await prisma.user.findMany({
    where: userPickerWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!users.find((u) => u.id === currentUserId)) {
    const me = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, name: true } });
    if (me) users.unshift(me);
  }

  const periodLabel = parsePeriod(period).label;

  return (
    <ForecastingClient
      period={period}
      periodKind={periodKind}
      forUserId={forUserId}
      includeTeam={includeTeam}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      users={users}
      rows={rows}
      summary={summary}
      topOpps={enriched}
      periodLabel={periodLabel}
    />
  );
}

// Helper exposed for ad-hoc callers that need today's quarter slug.
export const todayQuarterPeriod = currentQuarterPeriod;
