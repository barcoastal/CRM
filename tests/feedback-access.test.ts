import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  users: vi.fn(),
  permissions: vi.fn(),
  account: vi.fn(),
  accounts: vi.fn(),
  opportunity: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.user, findMany: m.users },
    account: { findFirst: m.account, findMany: m.accounts },
    opportunity: { findFirst: m.opportunity },
  },
}));
vi.mock("@/lib/permissions", async (original) => ({
  ...(await original<typeof import("@/lib/permissions")>()),
  loadEffectivePermissions: m.permissions,
}));
import { recordScope, canAccessRecord } from "@/lib/record-access";
import { isArchivedOpportunity } from "@/lib/opportunity-access";
import { resolveLeadAccount } from "@/lib/lead-account";
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
  m.accounts.mockResolvedValue([]);
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
it("allows an explicit archived-view permission while retaining ownership", async () => {
  m.permissions.mockResolvedValue(new Set(["Opportunity.ViewArchived"]));
  expect(await recordScope("opportunity")).toEqual({
    assignedToId: { in: ["agent"] },
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
    { ownerId: { in: ["agent"] } },
  ]);
});
