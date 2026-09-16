import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), count: vi.fn(), list: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/record-access", () => ({ recordScope: mocks.scope }));
vi.mock("@/lib/prisma", () => ({ prisma: { debt: { count: mocks.count, findMany: mocks.list, findFirst: mocks.find } } }));
vi.mock("@/components/opportunities/opportunity-negotiations", () => ({ OpportunityNegotiations: () => null }));
import Page from "@/app/(dashboard)/negotiations/page";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.scope.mockResolvedValue({ assignedToId: { in: ["me"] } });
  mocks.count.mockResolvedValue(0);
  mocks.list.mockResolvedValue([]);
  mocks.find.mockResolvedValue(null);
});
it("scopes both the list and selected debt to accessible opportunities", async () => {
  await Page({ searchParams: Promise.resolve({ debt: "someone-elses-debt" }) });
  const scope = { opportunity: { is: { assignedToId: { in: ["me"] } } } };
  expect(mocks.count).toHaveBeenCalledWith({ where: scope });
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "someone-elses-debt", ...scope } }));
});
it("combines search and status without dropping access scope and clamps pagination", async () => {
  mocks.count.mockResolvedValue(31);
  await Page({ searchParams: Promise.resolve({ q: "Acme", status: "NEGOTIATING", page: "999" }) });
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 30, where: expect.objectContaining({ status: "NEGOTIATING", opportunity: { is: { assignedToId: { in: ["me"] } } }, OR: expect.any(Array) }) }));
});
