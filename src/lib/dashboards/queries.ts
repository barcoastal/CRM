import { prisma } from "@/lib/prisma";

/**
 * Hardcoded query bank used by built-in dashboard tiles.
 *
 * Each query is registered in QUERY_REGISTRY with a kind (scalar or bar) and
 * a label. KPI / count / sum tiles use scalar queries that return { value,
 * format? }. Bar tiles use bar queries that return { buckets: [...] }.
 *
 * Queries return primitives only, no Prisma types — keep this safe to call
 * from API routes and server components alike. Errors should be thrown so
 * the caller can decide how to surface them.
 */

export type ScalarFormat = "currency" | "number" | "percent";

export interface ScalarResult {
  value: number;
  format?: ScalarFormat;
}

export interface BarBucket {
  label: string;
  value: number;
}

export interface BarResult {
  buckets: BarBucket[];
}

export type QueryRunner =
  | { kind: "scalar"; label: string; run: () => Promise<ScalarResult> }
  | { kind: "bar"; label: string; run: () => Promise<BarResult> };

// Helpers
function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function nextDays(n: number): Date {
  const d = new Date();
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

// Stages considered "terminal" for Lead.
const LEAD_TERMINAL = ["CONVERTED", "LOST", "DNC", "UNQUALIFIED"];

// Stages considered "non-closed" for Opportunity. The CRM uses free-text stage
// names; CLOSED_WON_FIRST_PAYMENT and CLOSED stages count as closed.
const OPP_CLOSED_STAGES = [
  "CLOSED",
  "CLOSED_WON_FIRST_PAYMENT",
  "Closed Won",
  "Closed Lost",
  "ARCHIVED",
];

export const QUERY_REGISTRY: Record<string, QueryRunner> = {
  // ---------------- LEADS ----------------
  "leads.total_open": {
    kind: "scalar",
    label: "Open Leads",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.lead.count({
        where: { status: { notIn: LEAD_TERMINAL } },
      });
      return { value, format: "number" };
    },
  },
  "leads.created_today": {
    kind: "scalar",
    label: "Leads Created Today",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.lead.count({
        where: { createdAt: { gte: startOfToday() } },
      });
      return { value, format: "number" };
    },
  },
  "leads.by_disposition": {
    kind: "bar",
    label: "Leads by Disposition",
    run: async (): Promise<BarResult> => {
      const rows = await prisma.lead.groupBy({
        by: ["lastDisposition"],
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });
      return {
        buckets: rows.map((r) => ({
          label: r.lastDisposition ?? "(none)",
          value: r._count._all,
        })),
      };
    },
  },

  // ---------------- OPPORTUNITIES ----------------
  "opportunities.pipeline_value": {
    kind: "scalar",
    label: "Pipeline Value",
    run: async (): Promise<ScalarResult> => {
      const agg = await prisma.opportunity.aggregate({
        where: { stage: { notIn: OPP_CLOSED_STAGES } },
        _sum: { totalDebt: true },
      });
      return { value: agg._sum.totalDebt ?? 0, format: "currency" };
    },
  },
  "opportunities.closed_won_mtd": {
    kind: "scalar",
    label: "Closed Won MTD",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.opportunity.count({
        where: {
          stage: { in: ["CLOSED_WON_FIRST_PAYMENT", "Closed Won"] },
          updatedAt: { gte: startOfMonth() },
        },
      });
      return { value, format: "number" };
    },
  },
  "opportunities.by_stage": {
    kind: "bar",
    label: "Opportunities by Stage",
    run: async (): Promise<BarResult> => {
      const rows = await prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });
      return {
        buckets: rows.map((r) => ({
          label: r.stage ?? "(none)",
          value: r._count._all,
        })),
      };
    },
  },

  // ---------------- ACCOUNTS ----------------
  "accounts.active": {
    kind: "scalar",
    label: "Active Accounts",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.account.count({ where: { isActive: true } });
      return { value, format: "number" };
    },
  },
  "accounts.in_nsf": {
    kind: "scalar",
    label: "Accounts in NSF",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.account.count({
        where: { paymentStatus: { contains: "NSF", mode: "insensitive" } },
      });
      return { value, format: "number" };
    },
  },

  // ---------------- ENVELOPES ----------------
  "envelopes.pending_signatures": {
    kind: "scalar",
    label: "Pending Signatures",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.envelope.count({
        where: { status: { in: ["SENT", "VIEWED"] } },
      });
      return { value, format: "number" };
    },
  },
  "envelopes.completed_this_month": {
    kind: "scalar",
    label: "Envelopes Completed MTD",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.envelope.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: startOfMonth() },
        },
      });
      return { value, format: "number" };
    },
  },

  // ---------------- TASKS ----------------
  "tasks.open_overdue": {
    kind: "scalar",
    label: "Overdue Tasks",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.task.count({
        where: {
          status: { not: "COMPLETED" },
          dueDate: { lt: new Date() },
        },
      });
      return { value, format: "number" };
    },
  },
  "tasks.due_today": {
    kind: "scalar",
    label: "Tasks Due Today",
    run: async (): Promise<ScalarResult> => {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const value = await prisma.task.count({
        where: {
          status: { notIn: ["COMPLETED", "DEFERRED"] },
          dueDate: { gte: start, lt: end },
        },
      });
      return { value, format: "number" };
    },
  },

  // ---------------- EVENTS ----------------
  "events.upcoming_7_days": {
    kind: "scalar",
    label: "Events in Next 7 Days",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.event.count({
        where: {
          startAt: { gte: new Date(), lt: nextDays(7) },
        },
      });
      return { value, format: "number" };
    },
  },

  // ---------------- CASES ----------------
  "cases.open_high_priority": {
    kind: "scalar",
    label: "Open High Priority Cases",
    run: async (): Promise<ScalarResult> => {
      const value = await prisma.case.count({
        where: {
          status: { notIn: ["CLOSED", "RESOLVED"] },
          priority: { in: ["HIGH", "URGENT"] },
        },
      });
      return { value, format: "number" };
    },
  },
};

export function getQuery(key: string): QueryRunner | undefined {
  return QUERY_REGISTRY[key];
}

export interface RegistryEntry {
  key: string;
  label: string;
  kind: "scalar" | "bar";
}

export function listRegistry(): RegistryEntry[] {
  return Object.entries(QUERY_REGISTRY).map(([key, { kind, label }]) => ({
    key,
    label,
    kind,
  }));
}
