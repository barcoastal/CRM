import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  users: vi.fn(),
  permissions: vi.fn(),
  account: vi.fn(),
  accounts: vi.fn(),
  opportunity: vi.fn(),
  opportunities: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.user, findMany: m.users },
    account: { findFirst: m.account, findMany: m.accounts },
    opportunity: { findFirst: m.opportunity, findMany: m.opportunities },
  },
}));
vi.mock("@/lib/permissions", async (original) => ({
  ...(await original<typeof import("@/lib/permissions")>()),
  loadEffectivePermissions: m.permissions,
}));
import { recordScope, canAccessRecord } from "@/lib/record-access";
import { canViewArchivedOpportunities, isArchivedOpportunity } from "@/lib/opportunity-access";
import { resolveLeadAccount } from "@/lib/lead-account";
import { GET as splitList } from "@/app/api/split-list/route";
import { GET as lookupAccounts } from "@/app/api/lookup/accounts/route";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "agent", permissions: [] } });
  m.user.mockResolvedValue({
    id: "agent",
    isActive: true,
    role: "SALES_REP",
    isCloser: true,
  });
  m.users.mockResolvedValue([]);
  m.permissions.mockResolvedValue(new Set());
  m.opportunity.mockResolvedValue(null);
  m.opportunities.mockResolvedValue([]);
  m.accounts.mockResolvedValue([]);
});
it("keeps archived records out of console lists and account lookup", async () => {
  m.auth.mockResolvedValue({ user: { id: "agent", email: "agent@example.com", role: "SALES_REP", permissions: ["Account.View"] } });
  await splitList(new NextRequest("http://localhost/api/split-list?entity=opportunities"));
  expect(m.opportunities.mock.calls[0][0].where.AND[1]).toEqual(await recordScope("opportunity"));
  await splitList(new NextRequest("http://localhost/api/split-list?entity=accounts"));
  expect(m.accounts.mock.calls[0][0].where.AND[1]).toEqual(await recordScope("account"));
  await lookupAccounts(new NextRequest("http://localhost/api/lookup/accounts?q=Acme"));
  expect(m.accounts.mock.calls[1][0].where.AND[0]).toEqual(await recordScope("account"));
});
it.each([
  "ARCHIVED",
  "Archived",
  "Archive Disposition",
  "Archived - Finalized",
  "ARCHIVED_FINALIZED",
])("identifies archived variant %s", (stage) =>
  expect(isArchivedOpportunity(stage)).toBe(true),
);
it("applies archive restrictions to the shared scope used by lists, search, and direct APIs", async () => {
  const scope = await recordScope("opportunity");
  expect(scope).toEqual({
    AND: [
      { assignedToId: { in: ["agent"] } },
      { NOT: { stage: { startsWith: "archive", mode: "insensitive" } } },
    ],
  });
  await canAccessRecord("opportunity", "archived");
  expect(m.opportunity).toHaveBeenLastCalledWith({
    where: { id: "archived", AND: [scope] },
    select: { id: true },
  });
});
it("keeps archived opportunities hidden even with an archived-view grant", async () => {
  m.permissions.mockResolvedValue(new Set(["Opportunity.ViewArchived"]));
  expect(await recordScope("opportunity")).toEqual({
    AND: [
      { assignedToId: { in: ["agent"] } },
      { NOT: { stage: { startsWith: "archive", mode: "insensitive" } } },
    ],
  });
});
it.each([
  { role: "CLOSER", isCloser: false },
  { isCloser: true },
  { closerTier: 2, isCloser: false },
  { profile: { name: "Closer" }, isCloser: false },
  { hierarchyRole: { name: "Closer", developerName: "Closer" }, isCloser: false },
])("applies the archive rule to closer identity %j", async (identity) => {
  m.user.mockResolvedValue({ id: "agent", role: "SALES_REP", isActive: true, ...identity });
  m.permissions.mockResolvedValue(new Set(["Modify.AllData", "Opportunity.ViewArchived"]));
  expect(await canViewArchivedOpportunities("agent")).toBe(false);
  expect(await recordScope("opportunity")).toMatchObject({
    AND: [
      { assignedToId: { in: ["agent"] } },
      { NOT: { stage: { startsWith: "archive", mode: "insensitive" } } },
    ],
  });
});
it("retains archived opportunities for a non-closer", async () => {
  m.user.mockResolvedValue({ id: "agent", role: "SALES_REP", isActive: true, isCloser: false, closerTier: null });
  expect(await canViewArchivedOpportunities("agent")).toBe(true);
  expect(await recordScope("opportunity")).toEqual({ assignedToId: { in: ["agent"] } });
});
it("does not let a closer's current all-record grant bypass archive filters", async () => {
  m.auth.mockResolvedValue({ user: { id: "agent", permissions: ["Modify.AllData", "Opportunity.ViewArchived"] } });
  m.permissions.mockResolvedValue(new Set(["Modify.AllData", "Opportunity.ViewArchived"]));
  expect(await recordScope("opportunity")).toEqual({ NOT: { stage: { startsWith: "archive", mode: "insensitive" } } });
  expect(await recordScope("account")).toEqual({
    isActive: true,
    OR: [
      { opportunities: { none: {} } },
      { opportunities: { some: { NOT: { stage: { startsWith: "archive", mode: "insensitive" } } } } },
    ],
  });
});
const lead = {
  id: "lead",
  sfId: null,
  convertedAccountId: null,
  businessName: "Business",
  ein: null,
  sfDataJson: null,
};
it("uses an explicit account relationship without guessing by name", async () => {
  m.account.mockResolvedValue({ id: "account", name: "Business" });
  expect(
    await resolveLeadAccount({ ...lead, convertedAccountId: "account" }),
  ).toEqual({ id: "account", name: "Business" });
  expect(m.accounts).not.toHaveBeenCalled();
});
it("does not route a lead to an ambiguous company match", async () => {
  m.accounts.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  expect(await resolveLeadAccount(lead)).toBeNull();
});
it("scopes even an exact company match to the user's account access", async () => {
  m.accounts.mockResolvedValue([{ id: "a", name: "Business" }]);
  expect((await resolveLeadAccount(lead))?.id).toBe("a");
  expect(m.accounts.mock.calls[0][0].where.AND).toEqual([
    { AND: [
      { ownerId: { in: ["agent"] } },
      { isActive: true, OR: [
        { opportunities: { none: {} } },
        { opportunities: { some: { NOT: { stage: { startsWith: "archive", mode: "insensitive" } } } } },
      ] },
    ] },
  ]);
});
