import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OPP_STAGES } from "@/lib/sf-canonical";

const OPP_STAGE_SET = new Set<string>(OPP_STAGES);

/**
 * Collapse opportunity stage rows to the 9 canonical stages, folding every
 * other value (dirty migration data) into a single "Other / unmapped" bucket
 * so the dashboard charts stay readable.
 */
function collapseStages(
  rows: { label: string | null; count: number; amount?: number }[],
): { label: string; count: number; amount: number }[] {
  const keep = new Map<string, { label: string; count: number; amount: number }>();
  let otherCount = 0;
  let otherAmount = 0;
  for (const r of rows) {
    const label = (r.label ?? "").trim();
    if (label && OPP_STAGE_SET.has(label)) {
      const e = keep.get(label) ?? { label, count: 0, amount: 0 };
      e.count += r.count;
      e.amount += r.amount ?? 0;
      keep.set(label, e);
    } else {
      otherCount += r.count;
      otherAmount += r.amount ?? 0;
    }
  }
  const out = Array.from(keep.values());
  if (otherCount > 0) out.push({ label: "Other / unmapped", count: otherCount, amount: otherAmount });
  return out.sort((a, b) => b.count - a.count);
}

// SF Manager Dashboard data feed.
//
// Supports three independent date filters (Salesforce parity):
//   createDate       — filter Lead.createdAt / Opportunity.createdAt
//   lastModifiedDate — filter Lead.updatedAt / Opportunity.updatedAt
//   programStartDate — filter Account.programStartDate (Key Deals / Recent Opps)
//
// Each filter accepts a from / to query pair (ISO date). Omitting both means
// "All Time" which is how SF renders the dashboard by default.

type Range = { gte?: Date; lt?: Date };

function rangeFromParams(
  searchParams: URLSearchParams,
  prefix: string,
): Range | undefined {
  const from = searchParams.get(`${prefix}From`);
  const to = searchParams.get(`${prefix}To`);
  if (!from && !to) return undefined;
  const range: Range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lt = new Date(new Date(to).getTime() + 86400000); // end of day
  return range;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const createDate = rangeFromParams(searchParams, "create");
  const lastModifiedDate = rangeFromParams(searchParams, "lastModified");
  const programStartDate = rangeFromParams(searchParams, "programStart");

  // Build where clauses for leads + opps. We combine createdAt + updatedAt
  // ranges with AND so both filters apply at once when set.
  const leadWhere: Record<string, unknown> = {};
  if (createDate) leadWhere.createdAt = createDate;
  if (lastModifiedDate) leadWhere.updatedAt = lastModifiedDate;

  const oppWhere: Record<string, unknown> = {};
  if (createDate) oppWhere.createdAt = createDate;
  if (lastModifiedDate) oppWhere.updatedAt = lastModifiedDate;

  const accountWhere: Record<string, unknown> = {};
  if (programStartDate) accountWhere.programStartDate = programStartDate;

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  try {
    const [
      leadsByStatusRaw,
      oppsByStageRaw,
      leadAmountByStatusRaw,
      oppAmountByStageRaw,
      leadsDispoRaw,
      oppsDispoRaw,
      todaysTasks,
      todaysEvents,
      recentRecords,
      keyDeals,
      totalLeads,
      totalOpps,
    ] = await Promise.all([
      // Leads donut: count by status
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
        where: leadWhere,
      }),

      // Opps donut: count by stage
      prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { id: true },
        where: oppWhere,
      }),

      // Leads bar: count + estimated debt by status
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalDebtEst: true },
        where: leadWhere,
      }),

      // Opps bar: count + amount by stage
      prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { id: true },
        _sum: { amount: true, currentTotalDebt: true },
        where: oppWhere,
      }),

      // Lead Disposition by Day (last 30 created days, grouped by day + status)
      prisma.lead.findMany({
        where: leadWhere,
        select: { createdAt: true, status: true, lastDisposition: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),

      // Opportunity Disposition by Day
      prisma.opportunity.findMany({
        where: oppWhere,
        select: { createdAt: true, stage: true, lastDisposition: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),

      // Today's Tasks (owner = current user)
      prisma.task.findMany({
        where: {
          ownerId: session.user.id,
          status: { not: "COMPLETED" },
          dueDate: { gte: todayStart, lt: todayEnd },
        },
        orderBy: { dueDate: "asc" },
        take: 25,
        select: {
          id: true,
          subject: true,
          priority: true,
          dueDate: true,
          status: true,
        },
      }),

      // Today's Events
      prisma.event.findMany({
        where: {
          ownerId: session.user.id,
          startAt: { gte: todayStart, lt: todayEnd },
        },
        orderBy: { startAt: "asc" },
        take: 25,
        select: {
          id: true,
          subject: true,
          startAt: true,
          endAt: true,
          location: true,
        },
      }),

      // Recent Records (mix of leads + accounts updated recently)
      prisma.account.findMany({
        where: accountWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          stage: true,
          updatedAt: true,
        },
      }),

      // Key Deals = recent opps with owner + account
      prisma.opportunity.findMany({
        where: oppWhere,
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          stage: true,
          amount: true,
          currentTotalDebt: true,
          totalDebt: true,
          updatedAt: true,
          account: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),

      prisma.lead.count({ where: leadWhere }),
      prisma.opportunity.count({ where: oppWhere }),
    ]);

    // Format leads + opps donuts
    const leadsByStatus = leadsByStatusRaw
      .map((row) => ({ label: row.status, count: row._count.id }))
      .sort((a, b) => b.count - a.count);

    const oppsByStage = collapseStages(
      oppsByStageRaw.map((row) => ({ label: row.stage, count: row._count.id })),
    ).map(({ label, count }) => ({ label, count }));

    // Leads bar (count + debt)
    const leadsBar = leadAmountByStatusRaw
      .map((row) => ({
        label: row.status,
        count: row._count.id,
        amount: row._sum.totalDebtEst ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const oppsBar = collapseStages(
      oppAmountByStageRaw.map((row) => ({
        label: row.stage,
        count: row._count.id,
        amount: row._sum.amount ?? row._sum.currentTotalDebt ?? 0,
      })),
    );

    // Build disposition-by-day tables. We bucket records by created date and
    // then by status/stage to match the SF "Created Date | Status | Record
    // Count" matrix.
    function buildDispo(
      rows: { createdAt: Date; status?: string; stage?: string; lastDisposition: string | null }[],
      statusKey: "status" | "stage",
    ) {
      const byDay = new Map<string, Map<string, number>>();
      for (const row of rows) {
        const day = ymd(row.createdAt);
        const status = (statusKey === "status" ? row.status : row.stage) ?? "(none)";
        if (!byDay.has(day)) byDay.set(day, new Map());
        const inner = byDay.get(day)!;
        inner.set(status, (inner.get(status) ?? 0) + 1);
      }
      const flat: { day: string; status: string; count: number; isSubtotal: boolean }[] = [];
      const sortedDays = Array.from(byDay.keys()).sort().reverse();
      for (const day of sortedDays) {
        const inner = byDay.get(day)!;
        let subtotal = 0;
        for (const [status, count] of inner.entries()) {
          flat.push({ day, status, count, isSubtotal: false });
          subtotal += count;
        }
        flat.push({ day, status: "Subtotal", count: subtotal, isSubtotal: true });
      }
      return flat;
    }

    const leadsDispo = buildDispo(
      leadsDispoRaw.map((r) => ({
        createdAt: r.createdAt,
        status: r.status,
        lastDisposition: r.lastDisposition,
      })),
      "status",
    );

    const oppsDispo = buildDispo(
      oppsDispoRaw.map((r) => ({
        createdAt: r.createdAt,
        stage: r.stage,
        lastDisposition: r.lastDisposition,
      })),
      "stage",
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        totalLeads,
        totalOpps,
      },
      leadsByStatus,
      oppsByStage,
      leadsBar,
      oppsBar,
      leadsDispo,
      oppsDispo,
      todaysTasks,
      todaysEvents,
      recentRecords,
      keyDeals,
    });
  } catch (error) {
    console.error("Manager dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load manager dashboard" },
      { status: 500 },
    );
  }
}
