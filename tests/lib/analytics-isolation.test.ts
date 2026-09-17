/* eslint-disable @typescript-eslint/no-explicit-any -- generic fixture query evaluator */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auth: vi.fn(), user: vi.fn(), users: vi.fn(),
  lead: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  opportunity: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  account: { findMany: vi.fn(), count: vi.fn() },
  task: { count: vi.fn(), findMany: vi.fn() }, event: { count: vi.fn(), findMany: vi.fn() }, case: { count: vi.fn() }, envelope: { count: vi.fn() },
  report: { findFirst: vi.fn(), update: vi.fn() }, dashboardTile: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ auth: db.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...db, user: { findUnique: db.user, findMany: db.users } } }));
import { analyticsAccess, analyticsScope, definitionScope } from "@/lib/analytics-access";
import { runReport } from "@/lib/reports/runner";
import { getQuery, listRegistry } from "@/lib/dashboards/queries";
import { POST as runSaved } from "@/app/api/reports/[id]/run/route";
import { PATCH as editTile, DELETE as deleteTile } from "@/app/api/dashboards/[id]/tiles/[tileId]/route";
import { GET as homeDashboard } from "@/app/api/dashboard/manager/route";
import { GET as legacyStats } from "@/app/api/dashboard/stats/route";
import { NextRequest } from "next/server";

// Small independent database fixture: queries are executed against unrelated teams.
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every(v => matches(row, v));
    if (key === "OR") return value.some((v: any) => matches(row, v));
    if (value === null || typeof value !== "object") return row[key] === value;
    return Object.entries(value).every(([op, val]: [string, any]) => {
      if (op === "equals") return row[key] === val;
      if (op === "in") return val.includes(row[key]);
      if (op === "notIn") return !val.includes(row[key]);
      if (op === "not") return row[key] !== val;
      if (op === "is") return val === null ? row[key] == null : row[key] != null && matches(row[key], val);
      if (op === "gte") return row[key] >= val;
      if (op === "lt") return row[key] < val;
      if (op === "contains") return String(row[key] ?? "").includes(val);
      if (op === "mode") return true;
      if (row[key] && typeof row[key] === "object") return matches(row[key], { [op]: val });
      throw new Error(`Unimplemented fixture operator ${op}`);
    });
  });
}
const users = [
  { id: "manager", managerId: null }, { id: "agent", managerId: "manager" },
  { id: "junior", managerId: "agent" }, { id: "outsider", managerId: null },
];
const accounts = [{ id: "visible", name: "Our account", ownerId: "agent" }, { id: "secret", name: "Other team's account", ownerId: "outsider" }];
const rows = [
  { id: "a", name: "Agent deal", assignedToId: "agent", totalDebt: 100, stage: "Working", account: accounts[0] },
  { id: "b", name: "Junior deal", assignedToId: "junior", totalDebt: 200, stage: "Working", account: accounts[1] },
  { id: "c", name: "Other deal", assignedToId: "outsider", totalDebt: 9000, stage: "Working", account: accounts[1] },
].map(row => ({ ...row, createdAt: new Date("2026-09-01T12:00:00Z"), lastDisposition: null }));
function login(id = "agent", role = "SALES_REP", permissions = ["Reports.View", "Dashboards.View", "Opportunity.View", "Account.View", "Lead.View", "Task.View", "Event.View", "Case.View", "Dashboards.Create"]) {
  db.auth.mockResolvedValue({ user: { id, permissions } });
  db.user.mockResolvedValue({ id, role, isActive: true });
}
const config = { objectType: "Opportunity", columns: ["name", "totalDebt", "account.name"], filters: [], summarize: [{ field: "totalDebt", kind: "sum" as const }] };

beforeEach(() => {
  vi.clearAllMocks(); login(); db.users.mockResolvedValue(users);
  db.opportunity.findMany.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)));
  db.account.findMany.mockImplementation(async ({ where }) => accounts.filter(row => matches(row, where)));
  db.opportunity.aggregate.mockImplementation(async ({ where }) => ({ _sum: { totalDebt: rows.filter(row => matches(row, where)).reduce((n, r) => n + r.totalDebt, 0) } }));
  db.opportunity.count.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)).length);
  db.opportunity.groupBy.mockImplementation(async ({ where }) => [{ stage: "Working", _sum: { amount: 0, currentTotalDebt: 0 }, _count: { _all: rows.filter(row => matches(row, where)).length, id: rows.filter(row => matches(row, where)).length } }]);
  db.lead.findMany.mockResolvedValue([]); db.lead.count.mockResolvedValue(0); db.lead.groupBy.mockResolvedValue([]);
  db.task.findMany.mockResolvedValue([]); db.event.findMany.mockResolvedValue([]);
  db.report.update.mockResolvedValue({});
});

describe("analytics authorization and isolation", () => {
  it("scopes the home dashboard totals and key deals and redacts a hidden account", async () => {
    login("junior");
    const response = await homeDashboard(new NextRequest("http://localhost/api/dashboard/manager"));
    expect(response.status).toBe(200); const body = await response.json();
    expect(body.totals.totalOpps).toBe(1);
    expect(body.keyDeals.map((r: any) => r.id)).toEqual(["b"]);
    expect(body.keyDeals[0].account).toBeNull(); expect(body.recentRecords).toEqual([]);
  });
  it("returns 403 for a report API caller without Reports.View", async () => {
    login("agent", "SALES_REP", []);
    const response = await runSaved(new NextRequest("http://localhost/api/reports/any/run", { method: "POST" }), { params: Promise.resolve({ id: "any" }) });
    expect(response.status).toBe(403); expect(db.report.findFirst).not.toHaveBeenCalled();
  });
  it("allows a dashboard owner to edit their tile with ownership in the write predicate", async () => {
    const tile = { id: "tile", dashboardId: "board", dashboard: { createdById: "agent", isShared: false } };
    db.dashboardTile.findFirst.mockImplementation(async ({ where }) => matches(tile, where) ? tile : null);
    db.dashboardTile.update.mockImplementation(async ({ where, data }) => { if (!matches(tile, where)) throw Error("Unauthorized write"); return { ...tile, ...data }; });
    const response = await editTile(new NextRequest("http://localhost/api/dashboards/board/tiles/tile", { method: "PATCH", body: JSON.stringify({ title: "Updated" }) }), { params: Promise.resolve({ id: "board", tileId: "tile" }) });
    expect(response.status).toBe(200); expect((await response.json()).title).toBe("Updated");
  });
  it("uses reporting relationships, never a manager role to grant all data", async () => {
    login("manager", "MANAGER");
    const result = await runReport(config);
    expect(result).not.toHaveProperty("error");
    if ("rows" in result) { expect(result.rows.map(r => r.name)).toEqual(["Agent deal", "Junior deal"]); expect(result.rows[1]["account.name"]).toBeNull(); }
    expect(await getQuery("opportunities.pipeline_value")!.run()).toEqual({ value: 300, format: "currency" });
  });
  it("limits a leaf agent to their assignment in report rows and aggregate charts", async () => {
    login("junior"); const report = await runReport(config);
    if (!("rows" in report)) throw Error(report.error);
    expect(report.rows).toHaveLength(1); expect(report.rows[0].name).toBe("Junior deal");
    expect(report.rows[0]["account.name"]).toBeNull();
    expect(await getQuery("opportunities.pipeline_value")!.run()).toEqual({ value: 200, format: "currency" });
    expect(await getQuery("opportunities.by_stage")!.run()).toEqual({ buckets: [{ label: "Working", value: 1 }] });
  });
  it.each(["ADMIN", "SUPER_ADMIN"])("retains full data for active %s", async role => {
    login("admin", role, []); const report = await runReport(config);
    if (!("rows" in report)) throw Error(report.error);
    expect(report.rows).toHaveLength(3); expect(report.rows[2]["account.name"]).toBe("Other team's account");
    expect(await getQuery("opportunities.pipeline_value")!.run()).toEqual({ value: 9300, format: "currency" });
  });
  it("does not allow a client OR filter to widen the assigned-record boundary", async () => {
    login("junior"); const result = await runReport({ ...config, filters: [
      { field: "name", operator: "equals", value: "Other deal", orGroup: "one" },
      { field: "name", operator: "equals", value: "Junior deal", orGroup: "two" },
    ] });
    if (!("rows" in result)) throw Error(result.error);
    expect(result.rows.map(r => r.name)).toEqual(["Junior deal"]);
  });
  it("does not permit hidden relation filters to reveal another team's account name", async () => {
    login("junior"); const result = await runReport({ ...config, filters: [{ field: "account.name", operator: "equals", value: "Other team's account" }] });
    if (!("rows" in result)) throw Error(result.error);
    expect(result.rows).toEqual([]);
  });
  it("requires object view permission in addition to Reports.View", async () => {
    login("junior", "SALES_REP", ["Reports.View"]); const result = await runReport(config);
    if (!("rows" in result)) throw Error(result.error);
    expect(result.rows).toEqual([]);
  });
  it("rejects unauthenticated and deactivated admins before data queries", async () => {
    db.auth.mockResolvedValue(null); await expect(runReport(config)).rejects.toMatchObject({ status: 401 });
    login("admin", "ADMIN"); db.user.mockResolvedValue({ id: "admin", role: "ADMIN", isActive: false });
    await expect(runReport(config)).rejects.toMatchObject({ status: 401 });
    expect(db.opportunity.findMany).not.toHaveBeenCalled();
  });
  it("rechecks permission changes on subsequent requests", async () => {
    await analyticsAccess("Reports.View"); login("agent", "SALES_REP", []);
    await expect(runReport(config)).rejects.toMatchObject({ status: 403 });
    expect(db.opportunity.findMany).not.toHaveBeenCalled();
  });
  it("does not let stale Modify.AllData expand a non-admin's record scope", async () => {
    login("junior", "SALES_REP", ["Modify.AllData"]);
    expect(analyticsScope(await analyticsAccess("Reports.View"), "opportunity")).toEqual({ OR: [{ assignedToId: { in: ["junior"] } }, { account: { is: { assignedNegotiatorId: { in: ["junior"] } } } }] });
  });
  it("blocks a private report by guessed ID before executing it", async () => {
    db.report.findFirst.mockImplementation(async ({ where }) => matches({ id: "private", createdById: "outsider", isShared: false }, where) ? { id: "private", ...config } : null);
    const response = await runSaved(new NextRequest("http://localhost/api/reports/private/run", { method: "POST" }), { params: Promise.resolve({ id: "private" }) });
    expect(response.status).toBe(404); expect(db.opportunity.findMany).not.toHaveBeenCalled();
  });
  it("shares definitions for viewing but never grants mutation rights to readers", async () => {
    const access = await analyticsAccess("Dashboards.View"); const shared = { isShared: true, createdById: "outsider" };
    expect(matches(shared, definitionScope(access))).toBe(true);
    expect(matches(shared, definitionScope(access, true))).toBe(false);
    const tile = { id: "tile", dashboardId: "board", dashboard: shared };
    db.dashboardTile.findFirst.mockImplementation(async ({ where }) => matches(tile, where) ? tile : null);
    for (const handler of [editTile, deleteTile]) {
      const response = await handler(new NextRequest("http://localhost/api/dashboards/board/tiles/tile", { method: "PATCH", body: JSON.stringify({ title: "hijack" }) }), { params: Promise.resolve({ id: "board", tileId: "tile" }) });
      expect(response.status).toBe(404);
    }
    expect(db.dashboardTile.update).not.toHaveBeenCalled(); expect(db.dashboardTile.delete).not.toHaveBeenCalled();
  });
  it("fails closed on unsupported analytics objects and legacy unscoped aggregates", async () => {
    const access = await analyticsAccess("Dashboards.View");
    expect(analyticsScope(access, "unknown")).toEqual({ id: { in: [] } });
    expect((await legacyStats(new NextRequest("http://localhost/api/dashboard/stats"))).status).toBe(403);
  });
  it("requires every linked envelope parent to be visible and rejects orphans", async () => {
    const access = await analyticsAccess("Dashboards.View"); const where = analyticsScope(access, "envelope");
    expect(matches({ leadId: null, opportunityId: "a", accountId: "secret", opportunity: rows[0], account: accounts[1] }, where)).toBe(false);
    expect(matches({ leadId: null, opportunityId: null, accountId: null }, where)).toBe(false);
    expect(matches({ leadId: null, opportunityId: "a", accountId: "visible", opportunity: rows[0], account: accounts[0] }, where)).toBe(true);
  });
  it("every dashboard registry query rejects an unauthenticated caller", async () => {
    db.auth.mockResolvedValue(null);
    for (const { key } of listRegistry()) await expect(getQuery(key)!.run()).rejects.toMatchObject({ status: 401 });
  });
});

it("adds and revokes negotiator report visibility with the account assignment", async () => {
 login("agent", "SALES_REP", ["Reports.View", "Account.View", "Opportunity.View"]);
 const access = await analyticsAccess("Reports.View");
 const account: Record<string, unknown> = { ownerId: "outsider", assignedNegotiatorId: "agent" };
 const opportunity = { assignedToId: "outsider", account };
 expect(matches(account, analyticsScope(access, "account"))).toBe(true);
 expect(matches(opportunity, analyticsScope(access, "opportunity"))).toBe(true);
 account.assignedNegotiatorId = "other";
 expect(matches(account, analyticsScope(access, "account"))).toBe(false);
 expect(matches(opportunity, analyticsScope(access, "opportunity"))).toBe(false);
 expect(matches({ ownerId: "outsider" }, analyticsScope(access, "contact"))).toBe(false);
});
