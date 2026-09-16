import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), count: vi.fn(), list: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/record-access", () => ({ recordScope: mocks.scope }));
vi.mock("@/lib/prisma", () => ({ prisma: { opportunity: { count: mocks.count, findMany: mocks.list, findFirst: mocks.find } } }));
vi.mock("@/components/opportunities/opportunity-negotiations", () => ({ OpportunityNegotiations: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import Page from "@/app/(dashboard)/negotiations/page";
import Detail from "@/app/(dashboard)/negotiations/[id]/page";
beforeEach(() => {
  vi.resetAllMocks();
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
