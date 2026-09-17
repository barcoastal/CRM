import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), users: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user, findMany: mocks.users } } }));
import { recordScope, teamOwnerIds } from "../../src/lib/record-access";
const users = [{ id: "manager", managerId: null }, { id: "agent", managerId: "manager" }, { id: "junior", managerId: "agent" }, { id: "other", managerId: null }];
describe("assigned records and manager teams", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "agent" } }); mocks.user.mockResolvedValue({ id: "agent", role: "SALES_REP", isActive: true }); mocks.users.mockResolvedValue([]); });
  it("limits an agent to their own assignments", async () => { expect(await recordScope("opportunity")).toEqual({ assignedToId: { in: ["agent"] } }); });
  it("uses ownerId for contacts", async () => { expect(await recordScope("contact")).toEqual({ ownerId: { in: ["agent"] } }); });
  it("includes descendants but not peers or other teams", () => { expect(teamOwnerIds("manager", users)).toEqual(["manager", "agent", "junior"]); expect(teamOwnerIds("junior", users)).toEqual(["junior"]); });
  it("terminates on cycles without duplicating users", () => { expect(teamOwnerIds("a", [{ id: "a", managerId: "b" }, { id: "b", managerId: "a" }])).toEqual(["a", "b"]); });
  it.each(["ADMIN", "SUPER_ADMIN"])("gives active %s full scope", async role => { mocks.user.mockResolvedValue({ id: "agent", role, isActive: true }); expect(await recordScope("account")).toEqual({}); expect(mocks.users).not.toHaveBeenCalled(); });
  it("denies disabled admins", async () => { mocks.user.mockResolvedValue({ id: "agent", role: "ADMIN", isActive: false }); expect(await recordScope("lead")).toEqual({ id: { in: [] } }); });
  it("denies unauthenticated requests", async () => { mocks.auth.mockResolvedValue(null); expect(await recordScope("lead")).toEqual({ id: { in: [] } }); });
  it("does not let stale global permissions override assignment scope", async () => { mocks.auth.mockResolvedValue({ user: { id: "agent", permissions: ["Modify.AllData"] } }); expect(await recordScope("lead")).toEqual({ assignedToId: { in: ["agent"] } }); });
});

it("grants a permitted negotiator account and opportunity sharing without assignment management", async () => {
 mocks.auth.mockResolvedValue({ user: { id: "agent", permissions: ["Account.View", "Opportunity.View"] } });
 mocks.user.mockResolvedValue({ id: "agent", role: "SALES_REP", isActive: true }); mocks.users.mockResolvedValue([]);
 expect(await recordScope("account")).toEqual({ OR: [{ ownerId: { in: ["agent"] } }, { assignedNegotiatorId: { in: ["agent"] } }] });
 expect(await recordScope("opportunity")).toEqual({ OR: [{ assignedToId: { in: ["agent"] } }, { account: { is: { assignedNegotiatorId: { in: ["agent"] } } } }] });
 expect(await recordScope("account", false)).toEqual({ ownerId: { in: ["agent"] } });
 mocks.auth.mockResolvedValue({ user: { id: "agent", permissions: [] } });
 expect(await recordScope("account")).toEqual({ ownerId: { in: ["agent"] } });
});
