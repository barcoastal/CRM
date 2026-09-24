import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CloserProduction = {
  userId: string; transfers: number; transferDebt: number; contractsOut: number;
  signed: number; grossDebt: number; canceled: number; canceledDebt: number;
  won: number; wonDebt: number; paid: number; paidDebt: number;
};

/** One reporting definition for the floor and TV. Archived versions and unsigned
 * working copies can carry a copied signing date; neither represents a sale. */
export function closerProductionQuery(ids: string[], from: Date, to: Date) {
  return Prisma.sql`
    WITH records AS (
      SELECT "assignedToId", "createdAt", "totalDebt", stage,
        COALESCE("firstContractSignedDateOpp", CASE WHEN stage ILIKE 'Closed Won%' OR stage = 'Contract Signed' THEN (
          SELECT MIN(h."changedAt") FROM "OpportunityHistory" h
          WHERE h."opportunityId" = o.id AND h.field IN ('Stage', 'stage', 'StageName')
            AND (h."newValue" ILIKE 'Closed Won%' OR h."newValue" = 'Contract Signed')
        ) END, "closeDate", "createdAt") AS signed_at,
        stage ILIKE 'Closed Won%' AS won,
        (stage ILIKE '%cancel%' OR stage ILIKE 'Closed Lost%') AS canceled,
        (stage ILIKE 'Closed Won%' OR stage = 'Contract Signed' OR
          ("firstContractSignedDateOpp" IS NOT NULL AND
            (stage ILIKE '%cancel%' OR stage ILIKE 'Closed Lost%'))) AS signed,
        (stage ILIKE 'Closed Won%' AND stage ILIKE '%First Payment Completed%') AS paid
      FROM "Opportunity" o
      WHERE "assignedToId" IN (${Prisma.join(ids)}) AND stage NOT ILIKE 'Archived%'
    )
    SELECT "assignedToId" AS "userId",
      COUNT(*) FILTER (WHERE "createdAt" >= ${from} AND "createdAt" < ${to})::int AS transfers,
      COALESCE(SUM("totalDebt") FILTER (WHERE "createdAt" >= ${from} AND "createdAt" < ${to}), 0)::float8 AS "transferDebt",
      COUNT(*) FILTER (WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND stage ILIKE '%Contract Sent%')::int AS "contractsOut",
      COUNT(*) FILTER (WHERE signed AND signed_at >= ${from} AND signed_at < ${to})::int AS signed,
      COALESCE(SUM("totalDebt") FILTER (WHERE signed AND signed_at >= ${from} AND signed_at < ${to}), 0)::float8 AS "grossDebt",
      COUNT(*) FILTER (WHERE signed AND canceled AND signed_at >= ${from} AND signed_at < ${to})::int AS canceled,
      COALESCE(SUM("totalDebt") FILTER (WHERE signed AND canceled AND signed_at >= ${from} AND signed_at < ${to}), 0)::float8 AS "canceledDebt",
      COUNT(*) FILTER (WHERE won AND signed_at >= ${from} AND signed_at < ${to})::int AS won,
      COALESCE(SUM("totalDebt") FILTER (WHERE won AND signed_at >= ${from} AND signed_at < ${to}), 0)::float8 AS "wonDebt",
      COUNT(*) FILTER (WHERE paid AND signed_at >= ${from} AND signed_at < ${to})::int AS paid,
      COALESCE(SUM("totalDebt") FILTER (WHERE paid AND signed_at >= ${from} AND signed_at < ${to}), 0)::float8 AS "paidDebt"
    FROM records GROUP BY "assignedToId"`;
}

export async function closerProduction(ids: string[], from: Date, to: Date) {
  if (!ids.length) return [];
  return prisma.$queryRaw<CloserProduction[]>(closerProductionQuery(ids, from, to));
}

export function hasPeriodProduction(row?: CloserProduction) {
  return !!row && (row.transfers > 0 || row.signed > 0);
}
