// Seeds ~20 saved Reports and 5 Dashboards so the Wave 1 report/dashboard
// builders aren't empty when Bar opens them. Safe to run repeatedly; UPSERTs
// by name and only inserts tiles when a dashboard is newly created.
//
// Run:
//   DATABASE_URL='postgres://...' node scripts/seed-reports-dashboards.mjs

import pg from "pg";
import { randomBytes } from "node:crypto";

const { Client } = pg;

function cuid() {
  // Good-enough collision-resistant id, mirrors Prisma's @default(cuid()) shape
  // for our purposes (length + opaqueness). Not strictly cuid algorithm.
  return "c" + randomBytes(12).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, 24).toLowerCase();
}

function daysAgoIso(n) {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
function todayIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}
function tomorrowIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}
function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// -------------------------- REPORTS --------------------------

const REPORTS = [
  // ---- LEADS ----
  {
    name: "Open Leads by Owner",
    description: "Leads not yet converted, disqualified, or archived, grouped by owner.",
    objectType: "Lead",
    columns: ["businessName", "contactName", "phone", "status", "assignedTo.name", "createdAt"],
    filters: [
      { field: "status", operator: "notIn", value: "CONVERTED,LOST,DNC,UNQUALIFIED,Converted,Disqualified,Archived" },
    ],
    groupBy: "assignedTo.name",
    sortBy: "createdAt",
    sortDir: "desc",
    summarize: [{ field: "id", kind: "count" }],
    rowLimit: 2000,
  },
  {
    name: "Hot Leads (Score > 50)",
    description: "High-scoring leads ready for outreach.",
    objectType: "Lead",
    columns: ["businessName", "contactName", "phone", "score", "status", "assignedTo.name", "createdAt"],
    filters: [{ field: "score", operator: "gt", value: 50 }],
    groupBy: null,
    sortBy: "score",
    sortDir: "desc",
    summarize: [],
    rowLimit: 100,
  },
  {
    name: "Leads by Source (Last 30 Days)",
    description: "Lead volume by source for the last 30 days.",
    objectType: "Lead",
    columns: ["businessName", "source", "status", "createdAt"],
    filters: [{ field: "createdAt", operator: "gt", value: daysAgoIso(30) }],
    groupBy: "source",
    sortBy: "createdAt",
    sortDir: "desc",
    summarize: [{ field: "id", kind: "count" }],
    rowLimit: 2000,
  },
  {
    name: "New Leads This Week",
    description: "Leads created in the last 7 days.",
    objectType: "Lead",
    columns: ["businessName", "contactName", "phone", "source", "assignedTo.name", "createdAt"],
    filters: [{ field: "createdAt", operator: "gt", value: daysAgoIso(7) }],
    groupBy: null,
    sortBy: "createdAt",
    sortDir: "desc",
    summarize: [],
    rowLimit: 500,
  },
  {
    name: "Leads by Disposition",
    description: "Lead distribution across last disposition.",
    objectType: "Lead",
    columns: ["businessName", "contactName", "lastDisposition", "lastDispositionAt", "assignedTo.name"],
    filters: [],
    groupBy: "lastDisposition",
    sortBy: "lastDispositionAt",
    sortDir: "desc",
    summarize: [{ field: "id", kind: "count" }],
    rowLimit: 2000,
  },

  // ---- OPPORTUNITIES ----
  {
    name: "Open Opportunities by Owner",
    description: "Active pipeline grouped by owner, summed amount per owner.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "stage", "amount", "totalDebt", "assignedTo.name", "createdAt"],
    filters: [
      { field: "stage", operator: "notIn", value: "CLOSED,CLOSED_WON_FIRST_PAYMENT,Closed Won,Closed Lost,ARCHIVED" },
    ],
    groupBy: "assignedTo.name",
    sortBy: "amount",
    sortDir: "desc",
    summarize: [{ field: "amount", kind: "sum" }],
    rowLimit: 2000,
  },
  {
    name: "Opportunities by Stage",
    description: "All opportunities grouped by stage with count and amount sum.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "stage", "amount", "totalDebt", "createdAt"],
    filters: [],
    groupBy: "stage",
    sortBy: "createdAt",
    sortDir: "desc",
    summarize: [
      { field: "id", kind: "count" },
      { field: "amount", kind: "sum" },
    ],
    rowLimit: 2000,
  },
  {
    name: "Closed Won This Month",
    description: "Opportunities marked Closed Won with close date in the current month.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "amount", "totalDebt", "closeDate", "assignedTo.name"],
    filters: [
      { field: "stage", operator: "in", value: "CLOSED_WON_FIRST_PAYMENT,Closed Won" },
      { field: "closeDate", operator: "gte", value: startOfMonthIso() },
    ],
    groupBy: null,
    sortBy: "closeDate",
    sortDir: "desc",
    summarize: [{ field: "amount", kind: "sum" }],
    rowLimit: 500,
  },
  {
    name: "Stalled Opportunities (14+ days)",
    description: "Open opportunities not contacted in over 14 days.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "stage", "amount", "lastContactedAt", "assignedTo.name"],
    filters: [
      { field: "stage", operator: "notIn", value: "CLOSED,CLOSED_WON_FIRST_PAYMENT,Closed Won,Closed Lost,ARCHIVED" },
      { field: "lastContactedAt", operator: "lt", value: daysAgoIso(14) },
    ],
    groupBy: null,
    sortBy: "lastContactedAt",
    sortDir: "asc",
    summarize: [],
    rowLimit: 500,
  },
  {
    name: "Pipeline Value by Owner",
    description: "Sum of open pipeline amount per owner.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "stage", "amount", "assignedTo.name"],
    filters: [
      { field: "stage", operator: "notIn", value: "CLOSED,CLOSED_WON_FIRST_PAYMENT,Closed Won,Closed Lost,ARCHIVED" },
    ],
    groupBy: "assignedTo.name",
    sortBy: "amount",
    sortDir: "desc",
    summarize: [{ field: "amount", kind: "sum" }],
    rowLimit: 2000,
  },

  // ---- ACCOUNTS ----
  {
    name: "Active Accounts",
    description: "All accounts with client status Active.",
    objectType: "Account",
    columns: ["name", "stage", "clientStatus", "currentTotalDebt", "owner.name", "createdAt"],
    filters: [{ field: "clientStatus", operator: "equals", value: "Active" }],
    groupBy: null,
    sortBy: "name",
    sortDir: "asc",
    summarize: [],
    rowLimit: 2000,
  },
  {
    name: "Accounts with Escrow > $5K",
    description: "Accounts with escrow balance greater than $5,000.",
    objectType: "Account",
    columns: ["name", "stage", "escrowBalance", "currentTotalDebt", "owner.name"],
    filters: [{ field: "escrowBalance", operator: "gt", value: 5000 }],
    groupBy: null,
    sortBy: "escrowBalance",
    sortDir: "desc",
    summarize: [{ field: "escrowBalance", kind: "sum" }],
    rowLimit: 500,
  },
  {
    name: "Accounts in NSF",
    description: "Accounts whose payment status contains NSF.",
    objectType: "Account",
    columns: ["name", "stage", "paymentStatus", "currentTotalDebt", "owner.name"],
    filters: [{ field: "paymentStatus", operator: "contains", value: "NSF" }],
    groupBy: null,
    sortBy: "name",
    sortDir: "asc",
    summarize: [],
    rowLimit: 500,
  },
  {
    name: "First Payment Pending",
    description: "Accounts whose stage is First Payment pending.",
    objectType: "Account",
    columns: ["name", "stage", "clientStatus", "programStartDate", "owner.name"],
    filters: [{ field: "stage", operator: "equals", value: "First Payment pending" }],
    groupBy: null,
    sortBy: "programStartDate",
    sortDir: "asc",
    summarize: [],
    rowLimit: 500,
  },
  {
    name: "Graduated Accounts (Last 90 Days)",
    description: "Accounts that reached Graduated stage in the past 90 days.",
    objectType: "Account",
    columns: ["name", "stage", "clientStatus", "programEndDate", "owner.name", "updatedAt"],
    filters: [
      { field: "stage", operator: "equals", value: "Graduated" },
      { field: "updatedAt", operator: "gt", value: daysAgoIso(90) },
    ],
    groupBy: null,
    sortBy: "updatedAt",
    sortDir: "desc",
    summarize: [],
    rowLimit: 500,
  },

  // ---- CASES ----
  {
    name: "Open Cases by Priority",
    description: "Open cases grouped by priority.",
    objectType: "Case",
    columns: ["caseNumber", "subject", "status", "priority", "owner.name", "createdAt"],
    filters: [{ field: "status", operator: "notIn", value: "RESOLVED,CLOSED,Resolved,Closed" }],
    groupBy: "priority",
    sortBy: "createdAt",
    sortDir: "desc",
    summarize: [{ field: "id", kind: "count" }],
    rowLimit: 1000,
  },

  // ---- TASKS ----
  {
    name: "Overdue Tasks",
    description: "Open tasks with a due date in the past.",
    objectType: "Task",
    columns: ["subject", "type", "status", "priority", "owner.name", "dueDate"],
    filters: [
      { field: "status", operator: "notIn", value: "COMPLETED,DEFERRED,Completed,Deferred" },
      { field: "dueDate", operator: "lt", value: todayIso() },
    ],
    groupBy: null,
    sortBy: "dueDate",
    sortDir: "asc",
    summarize: [],
    rowLimit: 1000,
  },
  {
    name: "Tasks Due Today",
    description: "Open tasks due today.",
    objectType: "Task",
    columns: ["subject", "type", "status", "priority", "owner.name", "dueDate"],
    filters: [
      { field: "status", operator: "notIn", value: "COMPLETED,DEFERRED,Completed,Deferred" },
      { field: "dueDate", operator: "gte", value: todayIso() },
      { field: "dueDate", operator: "lt", value: tomorrowIso() },
    ],
    groupBy: null,
    sortBy: "dueDate",
    sortDir: "asc",
    summarize: [],
    rowLimit: 500,
  },

  // ---- ENVELOPES ----
  {
    name: "Envelopes Sent vs Completed (Last 30 Days)",
    description: "Envelopes sent in the last 30 days grouped by current status.",
    objectType: "Envelope",
    columns: ["documentName", "status", "signerName", "sentAt", "completedAt", "createdBy.name"],
    filters: [{ field: "sentAt", operator: "gt", value: daysAgoIso(30) }],
    groupBy: "status",
    sortBy: "sentAt",
    sortDir: "desc",
    summarize: [{ field: "id", kind: "count" }],
    rowLimit: 2000,
  },

  // ---- CROSS-OBJECT SUMMARY ----
  {
    name: "Total Debt by Lead Source",
    description: "Sum of opportunity total debt grouped by lead source.",
    objectType: "Opportunity",
    columns: ["name", "account.name", "leadSource", "totalDebt", "stage"],
    filters: [],
    groupBy: "leadSource",
    sortBy: "totalDebt",
    sortDir: "desc",
    summarize: [{ field: "totalDebt", kind: "sum" }],
    rowLimit: 2000,
  },
];

// -------------------------- DASHBOARDS --------------------------

// Tiles use 12-col grid. KPIs are 3-wide at top, bars/tables span 6 or 12 below.
const DASHBOARDS = [
  {
    name: "Sales Overview",
    description: "Open leads, pipeline value, closed won MTD, and pending signatures.",
    tiles: [
      { kind: "kpi", title: "Open Leads", queryKey: "leads.total_open", position: { x: 0, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Pipeline Value", queryKey: "opportunities.pipeline_value", position: { x: 3, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Closed Won MTD", queryKey: "opportunities.closed_won_mtd", position: { x: 6, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Pending Signatures", queryKey: "envelopes.pending_signatures", position: { x: 9, y: 0, w: 3, h: 2 } },
      { kind: "bar", title: "Opportunities by Stage", queryKey: "opportunities.by_stage", position: { x: 0, y: 2, w: 12, h: 3 } },
    ],
  },
  {
    name: "Operations Dashboard",
    description: "Active accounts, pending signatures, overdue tasks, and opportunity flow.",
    tiles: [
      { kind: "kpi", title: "Active Accounts", queryKey: "accounts.active", position: { x: 0, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Pending Signatures", queryKey: "envelopes.pending_signatures", position: { x: 3, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Overdue Tasks", queryKey: "tasks.open_overdue", position: { x: 6, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Accounts in NSF", queryKey: "accounts.in_nsf", position: { x: 9, y: 0, w: 3, h: 2 } },
      { kind: "bar", title: "Opportunities by Stage", queryKey: "opportunities.by_stage", position: { x: 0, y: 2, w: 6, h: 3 } },
      { kind: "table", title: "Accounts in NSF", reportName: "Accounts in NSF", position: { x: 6, y: 2, w: 6, h: 3 } },
    ],
  },
  {
    name: "Marketing Performance",
    description: "Lead volume, source mix, and hot leads pipeline.",
    tiles: [
      { kind: "kpi", title: "Open Leads", queryKey: "leads.total_open", position: { x: 0, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Leads Created Today", queryKey: "leads.created_today", position: { x: 3, y: 0, w: 3, h: 2 } },
      { kind: "bar", title: "Leads by Disposition", queryKey: "leads.by_disposition", position: { x: 6, y: 0, w: 6, h: 2 } },
      { kind: "table", title: "Leads by Source (Last 30 Days)", reportName: "Leads by Source (Last 30 Days)", position: { x: 0, y: 2, w: 6, h: 3 } },
      { kind: "table", title: "Hot Leads (Score > 50)", reportName: "Hot Leads (Score > 50)", position: { x: 6, y: 2, w: 6, h: 3 } },
    ],
  },
  {
    name: "Customer Service Dashboard",
    description: "Open cases, overdue tasks, and upcoming events.",
    tiles: [
      { kind: "kpi", title: "Open High Priority Cases", queryKey: "cases.open_high_priority", position: { x: 0, y: 0, w: 4, h: 2 } },
      { kind: "kpi", title: "Overdue Tasks", queryKey: "tasks.open_overdue", position: { x: 4, y: 0, w: 4, h: 2 } },
      { kind: "kpi", title: "Events in Next 7 Days", queryKey: "events.upcoming_7_days", position: { x: 8, y: 0, w: 4, h: 2 } },
      { kind: "bar", title: "Opportunities by Stage", queryKey: "opportunities.by_stage", position: { x: 0, y: 2, w: 12, h: 3 } },
    ],
  },
  {
    name: "Executive Dashboard",
    description: "Pipeline value, closed won MTD, active accounts, completed envelopes.",
    tiles: [
      { kind: "kpi", title: "Pipeline Value", queryKey: "opportunities.pipeline_value", position: { x: 0, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Closed Won MTD", queryKey: "opportunities.closed_won_mtd", position: { x: 3, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Active Accounts", queryKey: "accounts.active", position: { x: 6, y: 0, w: 3, h: 2 } },
      { kind: "kpi", title: "Envelopes Completed MTD", queryKey: "envelopes.completed_this_month", position: { x: 9, y: 0, w: 3, h: 2 } },
    ],
  },
];

// -------------------------- RUN --------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  let admin = await c.query(
    `SELECT id FROM "User" WHERE email IN ('bar@coastaldebt.com','bar@albert-capital.com') ORDER BY CASE WHEN email='bar@coastaldebt.com' THEN 0 ELSE 1 END LIMIT 1`,
  );
  if (admin.rowCount === 0) {
    admin = await c.query(`SELECT id FROM "User" WHERE role='ADMIN' ORDER BY "createdAt" ASC LIMIT 1`);
  }
  if (admin.rowCount === 0) {
    console.error("Could not find bar's admin user. Aborting.");
    process.exit(1);
  }
  const adminId = admin.rows[0].id;
  console.log(`Using admin user id: ${adminId}`);

  // ---- Reports
  const reportIdByName = new Map();
  let reportsAdded = 0;
  let reportsSkipped = 0;
  for (const r of REPORTS) {
    const existing = await c.query(`SELECT id FROM "Report" WHERE name = $1 LIMIT 1`, [r.name]);
    if (existing.rowCount > 0) {
      reportIdByName.set(r.name, existing.rows[0].id);
      reportsSkipped++;
      continue;
    }
    const id = cuid();
    await c.query(
      `INSERT INTO "Report" (id, name, description, "objectType", "columns", "filters", "groupBy", "sortBy", "sortDir", summarize, "rowLimit", "isShared", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb, $11, true, $12, NOW(), NOW())`,
      [
        id,
        r.name,
        r.description,
        r.objectType,
        JSON.stringify(r.columns),
        JSON.stringify(r.filters),
        r.groupBy,
        r.sortBy,
        r.sortDir,
        JSON.stringify(r.summarize),
        r.rowLimit,
        adminId,
      ],
    );
    reportIdByName.set(r.name, id);
    reportsAdded++;
    console.log(`  + report: ${r.name}`);
  }
  console.log(`Reports: ${reportsAdded} added, ${reportsSkipped} skipped`);

  // ---- Dashboards
  let dashboardsAdded = 0;
  let dashboardsSkipped = 0;
  let tilesAdded = 0;
  for (const d of DASHBOARDS) {
    const existing = await c.query(`SELECT id FROM "Dashboard" WHERE name = $1 LIMIT 1`, [d.name]);
    if (existing.rowCount > 0) {
      dashboardsSkipped++;
      console.log(`  = dashboard exists: ${d.name}`);
      continue;
    }
    const dashId = cuid();
    await c.query(
      `INSERT INTO "Dashboard" (id, name, description, layout, "isShared", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, true, $5, NOW(), NOW())`,
      [dashId, d.name, d.description, JSON.stringify([]), adminId],
    );
    for (const t of d.tiles) {
      const tileId = cuid();
      let reportId = null;
      if (t.reportName) {
        reportId = reportIdByName.get(t.reportName);
        if (!reportId) {
          // Look it up in case it was seeded in an earlier run.
          const r = await c.query(`SELECT id FROM "Report" WHERE name = $1 LIMIT 1`, [t.reportName]);
          if (r.rowCount > 0) reportId = r.rows[0].id;
        }
        if (!reportId) {
          console.warn(`  ! tile "${t.title}" references missing report "${t.reportName}"; skipping`);
          continue;
        }
      }
      await c.query(
        `INSERT INTO "DashboardTile" (id, "dashboardId", kind, title, "queryKey", "reportId", config, position, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW())`,
        [
          tileId,
          dashId,
          t.kind,
          t.title,
          t.queryKey ?? null,
          reportId,
          JSON.stringify(t.config ?? {}),
          JSON.stringify(t.position),
        ],
      );
      tilesAdded++;
    }
    dashboardsAdded++;
    console.log(`  + dashboard: ${d.name} (${d.tiles.length} tiles)`);
  }
  console.log(`Dashboards: ${dashboardsAdded} added, ${dashboardsSkipped} skipped`);
  console.log(`Tiles inserted: ${tilesAdded}`);

  await c.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
