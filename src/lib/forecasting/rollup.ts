/**
 * Forecast rollup engine.
 *
 * Walks the manager hierarchy starting at `forUserId`, loads all Opportunities
 * with `closeDate` in the period range, and groups amounts by owner +
 * effective ForecastCategory. Category = explicit `forecastCategory` if set,
 * else `defaultCategoryForStage(stage)`.
 */

import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABEL,
  FORECAST_CATEGORIES,
  defaultCategoryForStage,
  isForecastCategory,
  type ForecastCategory,
} from "./categories";
import { parsePeriod } from "./period";

export type RollupRow = {
  userId: string;
  userName: string;
  managerId: string | null;
  amounts: Record<ForecastCategory, number>;
  count: number;
  total: number;
  quota: number | null;
  attainment: number | null; // closed / quota (decimal, e.g. 0.5 = 50%)
};

export interface BuildForecastRollupArgs {
  period: string;
  forUserId?: string | null;
  includeTeam?: boolean;
}

const ZERO_AMOUNTS = (): Record<ForecastCategory, number> => ({
  COMMIT: 0,
  BEST_CASE: 0,
  PIPELINE: 0,
  CLOSED: 0,
  OMITTED: 0,
});

/**
 * Walk the User.manager -> reports tree starting at `rootUserId`.
 * Returns the set of user IDs including the root.
 */
async function collectTeamUserIds(rootUserId: string): Promise<Set<string>> {
  const ids = new Set<string>([rootUserId]);
  let frontier = [rootUserId];
  // Bounded loop to avoid infinite recursion if a cycle ever crept in.
  for (let depth = 0; depth < 20 && frontier.length > 0; depth++) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const r of reports) {
      if (!ids.has(r.id)) {
        ids.add(r.id);
        next.push(r.id);
      }
    }
    frontier = next;
  }
  return ids;
}

export async function buildForecastRollup(opts: BuildForecastRollupArgs): Promise<RollupRow[]> {
  const { period, forUserId, includeTeam } = opts;
  const { start, endExclusive } = parsePeriod(period);

  // 1. Resolve target user set.
  let userIds: string[] | null = null; // null = all users (manager looking at full org)
  if (forUserId) {
    if (includeTeam) {
      const teamIds = await collectTeamUserIds(forUserId);
      userIds = Array.from(teamIds);
    } else {
      userIds = [forUserId];
    }
  }

  const userWhere = userIds ? { id: { in: userIds } } : {};
  const users = await prisma.user.findMany({
    where: { ...userWhere, isActive: true },
    select: { id: true, name: true, managerId: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const targetIds = users.map((u) => u.id);

  if (targetIds.length === 0) return [];

  // 2. Load opps in window owned by any target user.
  const opps = await prisma.opportunity.findMany({
    where: {
      assignedToId: { in: targetIds },
      closeDate: { gte: start, lt: endExclusive },
    },
    select: {
      id: true,
      assignedToId: true,
      stage: true,
      forecastCategory: true,
      amount: true,
      totalDebt: true,
    },
  });

  // 3. Group by owner + category.
  const rowsByUser = new Map<string, RollupRow>();
  for (const u of users) {
    rowsByUser.set(u.id, {
      userId: u.id,
      userName: u.name,
      managerId: u.managerId ?? null,
      amounts: ZERO_AMOUNTS(),
      count: 0,
      total: 0,
      quota: null,
      attainment: null,
    });
  }

  for (const opp of opps) {
    if (!opp.assignedToId) continue;
    const row = rowsByUser.get(opp.assignedToId);
    if (!row) continue;
    const explicit = opp.forecastCategory;
    const category: ForecastCategory =
      explicit && isForecastCategory(explicit)
        ? (explicit as ForecastCategory)
        : defaultCategoryForStage(opp.stage);
    const amt =
      typeof opp.amount === "number" ? opp.amount : typeof opp.totalDebt === "number" ? opp.totalDebt : 0;
    row.amounts[category] += amt;
    row.count += 1;
    // OMITTED is shown but does not count toward the rep's total.
    if (category !== "OMITTED") row.total += amt;
  }

  // 4. Load quotas for the period.
  const quotas = await prisma.quota.findMany({
    where: { userId: { in: targetIds }, period },
    select: { userId: true, amount: true },
  });
  for (const q of quotas) {
    const row = rowsByUser.get(q.userId);
    if (!row) continue;
    const amt = Number(q.amount ?? 0);
    row.quota = amt;
    if (amt > 0) {
      row.attainment = row.amounts.CLOSED / amt;
    }
  }

  // 5. Sort by total desc, then name.
  return Array.from(rowsByUser.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.userName.localeCompare(b.userName);
  });
}

/**
 * Convenience: sum totals across rows for the top-of-page KPI tiles.
 */
export function summarizeRollup(rows: RollupRow[]) {
  const totals = ZERO_AMOUNTS();
  let totalCount = 0;
  let totalQuota = 0;
  for (const r of rows) {
    for (const c of FORECAST_CATEGORIES) totals[c] += r.amounts[c];
    totalCount += r.count;
    if (r.quota) totalQuota += r.quota;
  }
  const grand = FORECAST_CATEGORIES.filter((c) => c !== "OMITTED").reduce((s, c) => s + totals[c], 0);
  return {
    totals,
    totalCount,
    totalQuota,
    grand,
    attainment: totalQuota > 0 ? totals.CLOSED / totalQuota : null,
  };
}

export { CATEGORY_LABEL };
