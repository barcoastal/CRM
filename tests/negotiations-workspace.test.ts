import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), documents: vi.fn(), auth: vi.fn(), mail: vi.fn(), scope: vi.fn(), count: vi.fn(), list: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/record-access", () => ({ recordScope: mocks.scope, canAccessRecord: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { document: { findMany: mocks.documents }, emailMessage: { findMany: mocks.mail }, opportunity: { count: mocks.count, findMany: mocks.list, findFirst: mocks.find } } }));
vi.mock("@/components/opportunities/opportunity-negotiations", () => ({ OpportunityNegotiations: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import Page from "@/app/(dashboard)/negotiations/page";
import Detail from "@/app/(dashboard)/negotiations/[id]/page";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "me", email: "rep@example.com", permissions: ["Email.Send"] } });
  mocks.scope.mockResolvedValue({ assignedToId: { in: ["me"] } });
  mocks.count.mockResolvedValue(0); mocks.list.mockResolvedValue([]); mocks.find.mockResolvedValue(null);
});
it("scopes opportunities to the user's records and requires debts", async () => {
  await Page({ searchParams: Promise.resolve({}) });
  const where = { AND: [{ assignedToId: { in: ["me"] } }], debts: { some: {} } };
  expect(mocks.count).toHaveBeenCalledWith({ where });
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where }));
});
it("searches while preserving access scope and clamps pagination", async () => {
  mocks.count.mockResolvedValue(31);
  await Page({ searchParams: Promise.resolve({ q: "Acme", page: "999" }) });
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 30, where: expect.objectContaining({ AND: [{ assignedToId: { in: ["me"] } }], OR: expect.any(Array) }) }));
});
it("rejects inaccessible opportunity workspaces", async () => {
  await expect(Detail({ params: Promise.resolve({ id: "other" }) })).rejects.toThrow("NOT_FOUND");
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other", AND: [{ assignedToId: { in: ["me"] } }] } }));
});

it("only pulls the current user's emails linked to this opportunity", async () => {
  mocks.find.mockResolvedValue({ id: "opp", name: "Opportunity", debts: [] });
  mocks.mail.mockResolvedValue([]);
  await Detail({ params: Promise.resolve({ id: "opp" }) });
  expect(mocks.mail).toHaveBeenCalledWith(expect.objectContaining({ where: { opportunityId: "opp", ownerId: "me" }, take: 50 }));
});

it("includes own linked thread replies without pulling another opportunity's messages", async () => {
  mocks.find.mockResolvedValue({ id: "opp", name: "Opportunity", debts: [] });
  mocks.mail.mockResolvedValueOnce([{ id: "email", threadId: "thread", createdAt: new Date() }]).mockResolvedValueOnce([]);
  await Detail({ params: Promise.resolve({ id: "opp" }) });
  expect(mocks.mail).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { ownerId: "me", threadId: { in: ["thread"] }, OR: [{ opportunityId: "opp" }, { opportunityId: null }] } }));
});
it("only includes related account documents when access is allowed", async () => {
  mocks.find.mockResolvedValue({ id: "opp", name: "Opportunity", debts: [], accountId: "account", leadId: "lead" });
  mocks.mail.mockResolvedValue([]); mocks.documents.mockResolvedValue([]);
  mocks.access.mockImplementation(async (type: string) => type === "account");
  await Detail({ params: Promise.resolve({ id: "opp" }) });
  expect(mocks.documents).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ accountId: "account" }] } }));
});
