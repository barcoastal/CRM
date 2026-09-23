import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { scoreboardMonthRange, type MonthlyCloser, type WinCursor, type WinPayload } from "./scoreboard-shared";

type ProductionRow = {
  userId: string; transfers: number; contractsOut: number; signed: number; grossDebt: number;
  canceled: number; canceledDebt: number; won: number; paid: number; paidDebt: number;
};

export async function monthlyScoreboard(period: string, now = new Date()): Promise<MonthlyCloser[]> {
  const { from, to } = scoreboardMonthRange(period);
  const end = new Date(Math.min(to.getTime(), now.getTime()));
  const closers = await prisma.user.findMany({
    where: { isActive: true, OR: [{ isCloser: true }, { closerTier: { not: null } }] },
    select: { id: true, name: true, closerTier: true }, orderBy: { name: "asc" },
  });
  if (!closers.length) return [];
  const ids = closers.map((u) => u.id);
  const [production, targets] = await Promise.all([
    // Only aggregate the configured roster; no client identities leave this query.
    prisma.$queryRaw<ProductionRow[]>(Prisma.sql`
      WITH records AS (
        SELECT "assignedToId", "createdAt", "totalDebt", stage,
          COALESCE("firstContractSignedDateOpp",
            CASE WHEN stage ILIKE 'Closed Won%' OR stage = 'Contract Signed' THEN (
              SELECT MIN(h."changedAt") FROM "OpportunityHistory" h
              WHERE h."opportunityId" = o.id AND h.field IN ('Stage', 'stage', 'StageName')
                AND (h."newValue" ILIKE 'Closed Won%' OR h."newValue" = 'Contract Signed')
            ) END, "closeDate", "createdAt") AS signed_at,
          (stage ILIKE 'Closed Won%') AS won,
          (stage ILIKE '%cancel%' OR stage ILIKE 'Closed Lost%' OR stage ILIKE 'Archived%') AS canceled,
          ("firstContractSignedDateOpp" IS NOT NULL OR stage ILIKE 'Closed Won%' OR stage = 'Contract Signed') AS signed,
          (stage ILIKE '%First Payment Completed%') AS paid
        FROM "Opportunity" o WHERE "assignedToId" IN (${Prisma.join(ids)})
      )
      SELECT "assignedToId" AS "userId",
        COUNT(*) FILTER (WHERE "createdAt" >= ${from} AND "createdAt" < ${end})::int AS transfers,
        COUNT(*) FILTER (WHERE "createdAt" >= ${from} AND "createdAt" < ${end} AND stage ILIKE '%Contract Sent%')::int AS "contractsOut",
        COUNT(*) FILTER (WHERE signed AND signed_at >= ${from} AND signed_at < ${end})::int AS signed,
        COALESCE(SUM("totalDebt") FILTER (WHERE signed AND signed_at >= ${from} AND signed_at < ${end}), 0)::float8 AS "grossDebt",
        COUNT(*) FILTER (WHERE signed AND canceled AND signed_at >= ${from} AND signed_at < ${end})::int AS canceled,
        COALESCE(SUM("totalDebt") FILTER (WHERE signed AND canceled AND signed_at >= ${from} AND signed_at < ${end}), 0)::float8 AS "canceledDebt",
        COUNT(*) FILTER (WHERE won AND signed_at >= ${from} AND signed_at < ${end})::int AS won,
        COUNT(*) FILTER (WHERE paid AND signed_at >= ${from} AND signed_at < ${end})::int AS paid,
        COALESCE(SUM("totalDebt") FILTER (WHERE paid AND signed_at >= ${from} AND signed_at < ${end}), 0)::float8 AS "paidDebt"
      FROM records GROUP BY "assignedToId"`),
    prisma.closerScoreboardTarget.findMany({ where: { period, userId: { in: ids } } }),
  ]);
  const byUser = new Map(production.map((r) => [r.userId, r]));
  const goals = new Map(targets.map((r) => [r.userId, r]));
  return closers.map((u): MonthlyCloser => {
    const p = byUser.get(u.id);
    const g = goals.get(u.id);
    return {
      userId: u.id, name: u.name, tier: u.closerTier,
      transfers: p?.transfers ?? 0, contractsOut: p?.contractsOut ?? 0,
      signed: p?.signed ?? 0, grossDebt: p?.grossDebt ?? 0, canceled: p?.canceled ?? 0,
      canceledDebt: p?.canceledDebt ?? 0, netDebt: (p?.grossDebt ?? 0) - (p?.canceledDebt ?? 0),
      won: p?.won ?? 0, paid: p?.paid ?? 0, paidDebt: p?.paidDebt ?? 0,
      debtTarget: g?.debtTarget ?? null, contractTarget: g?.contractTarget ?? null,
      firstPaymentDebtTarget: g?.firstPaymentDebtTarget ?? null,
    };
  }).sort((a, b) => b.grossDebt - a.grossDebt || b.signed - a.signed || a.name.localeCompare(b.name));
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
