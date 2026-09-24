import { prisma } from "@/lib/prisma";
import { closerProduction, hasPeriodProduction } from "./closer-production";
import { scoreboardMonthRange, type MonthlyCloser, type PassPayload, type WinCursor, type WinPayload } from "./scoreboard-shared";

export async function monthlyScoreboard(period: string, now = new Date()): Promise<MonthlyCloser[]> {
  const { from, to } = scoreboardMonthRange(period);
  const end = new Date(Math.min(to.getTime(), now.getTime()));
  const closers = await prisma.user.findMany({
    where: { OR: [{ isCloser: true }, { closerTier: { not: null } }] },
    select: { id: true, name: true, closerTier: true, isActive: true }, orderBy: { name: "asc" },
  });
  if (!closers.length) return [];
  const ids = closers.map((u) => u.id);
  const [production, targets] = await Promise.all([
    closerProduction(ids, from, end),
    prisma.closerScoreboardTarget.findMany({ where: { period, userId: { in: ids } } }),
  ]);
  const byUser = new Map(production.map((r) => [r.userId, r]));
  const goals = new Map(targets.map((r) => [r.userId, r]));
  return closers.filter((u) => u.isActive || hasPeriodProduction(byUser.get(u.id))).map((u): MonthlyCloser => {
    const p = byUser.get(u.id);
    const g = goals.get(u.id);
    return {
      userId: u.id, name: u.name, tier: u.closerTier, isActive: u.isActive,
      transfers: p?.transfers ?? 0, contractsOut: p?.contractsOut ?? 0,
      signed: p?.signed ?? 0, grossDebt: p?.grossDebt ?? 0, canceled: p?.canceled ?? 0,
      canceledDebt: p?.canceledDebt ?? 0, netDebt: (p?.grossDebt ?? 0) - (p?.canceledDebt ?? 0),
      won: p?.won ?? 0, wonDebt: p?.wonDebt ?? 0, paid: p?.paid ?? 0, paidDebt: p?.paidDebt ?? 0,
      debtTarget: g?.debtTarget ?? null, contractTarget: g?.contractTarget ?? null,
      firstPaymentDebtTarget: g?.firstPaymentDebtTarget ?? null,
    };
  }).sort((a, b) => b.wonDebt - a.wonDebt || b.won - a.won || a.name.localeCompare(b.name));
}

export async function scoreboardWins(cursor: WinCursor | null, now = new Date()): Promise<WinPayload> {
  // A small overlap on subsequent polls catches transactions that were still
  // committing at the last poll. Event IDs handle duplicate observations.
  const until = new Date(now.getTime() - 2_000);
  if (!cursor) return { events: [], cursor: { at: until.toISOString(), id: "" }, hasMore: false };
  const lower = new Date(Math.max(Date.parse(cursor.at), now.getTime() - 60 * 60_000));
  const rows = await prisma.opportunityHistory.findMany({
    where: {
      field: { in: ["Stage", "stage", "StageName"] },
      newValue: { startsWith: "Closed Won", mode: "insensitive" },
      AND: [
        { OR: [{ oldValue: null }, { NOT: { oldValue: { startsWith: "Closed Won", mode: "insensitive" } } }] },
        { OR: [{ changedAt: { gt: lower } }, { changedAt: lower, id: { gt: cursor.id } }] },
      ],
      changedAt: { lte: until },
      opportunity: {
        stage: { startsWith: "Closed Won", mode: "insensitive" },
        assignedTo: { is: { isActive: true, OR: [{ isCloser: true }, { closerTier: { not: null } }] } },
      },
    },
    select: {
      id: true, opportunityId: true, changedAt: true,
      opportunity: { select: { totalDebt: true, assignedTo: { select: { id: true, name: true } } } },
    },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }], take: 101,
  });
  const hasMore = rows.length > 100;
  const page = rows.slice(0, 100);
  const last = page.at(-1);
  return {
    events: page.flatMap((row) => row.opportunity.assignedTo ? [{
      id: row.id, opportunityId: row.opportunityId, closerId: row.opportunity.assignedTo.id,
      closerName: row.opportunity.assignedTo.name, debt: row.opportunity.totalDebt, at: row.changedAt.toISOString(),
    }] : []),
    cursor: hasMore && last ? { at: last.changedAt.toISOString(), id: last.id } : { at: new Date(until.getTime() - 5_000).toISOString(), id: "" },
    hasMore,
  };
}

/** A recorded Floor Manager handoff is a pass thrown to the selected closer. */
export async function scoreboardPasses(cursor: WinCursor | null, now = new Date()): Promise<PassPayload> {
  const until = new Date(now.getTime() - 2_000);
  if (!cursor) return { events: [], cursor: { at: until.toISOString(), id: "" }, hasMore: false };
  const lower = new Date(Math.max(Date.parse(cursor.at), now.getTime() - 60 * 60_000));
  const rows = await prisma.closerHandoff.findMany({
    where: {
      createdAt: { lte: until },
      OR: [{ createdAt: { gt: lower } }, { createdAt: lower, id: { gt: cursor.id } }],
      closer: { is: { isActive: true, OR: [{ isCloser: true }, { closerTier: { not: null } }] } },
    },
    select: {
      id: true, createdAt: true, opportunityId: true, debt: true, debtLabel: true,
      closer: { select: { id: true, name: true } }, fronter: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 101,
  });
  const hasMore = rows.length > 100;
  const page = rows.slice(0, 100);
  const last = page.at(-1);
  return {
    events: page.flatMap((row) => row.closer ? [{
      kind: "pass" as const, id: `pass:${row.id}`, opportunityId: row.opportunityId ?? "",
      closerId: row.closer.id, closerName: row.closer.name, fronterName: row.fronter?.name ?? null,
      debt: row.debt, debtLabel: row.debtLabel, at: row.createdAt.toISOString(),
    }] : []),
    cursor: hasMore && last ? { at: last.createdAt.toISOString(), id: last.id } : { at: new Date(until.getTime() - 5_000).toISOString(), id: "" },
    hasMore,
  };
}
