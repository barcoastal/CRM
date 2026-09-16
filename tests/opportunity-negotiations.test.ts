import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ access: vi.fn(), auth: vi.fn(), find: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.access }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { debt: { findFirst: mocks.find }, negotiation: { create: mocks.create } } }));
import { POST } from "@/app/api/opportunities/[id]/debts/[debtId]/negotiations/route";
const valid = { type: "CALL", date: "2026-09-16", response: "COUNTERED", offerAmount: 1000, counterAmount: 1200 };
function save(body: unknown) {
  return POST(new NextRequest("http://localhost/api/negotiations", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "opp-1", debtId: "debt-1" }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.auth.mockResolvedValue({ session: { userId: "user-1" } });
  mocks.find.mockResolvedValue({ id: "debt-1" });
  mocks.create.mockResolvedValue({ id: "neg-1" });
});
describe("opportunity negotiation recording", () => {
  it("requires permission before accessing debts", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await save(valid)).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith("Debt.Edit");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("rejects inaccessible opportunities", async () => {
    mocks.access.mockResolvedValue(false);
    expect((await save(valid)).status).toBe(404);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects debts outside the opportunity", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await save(valid)).status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: "debt-1", opportunityId: "opp-1" } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([{ ...valid, date: "bad" }, { ...valid, offerAmount: -1 }, { ...valid, offerPercent: 101 }, null])("rejects invalid input %j", async (body) => {
    expect((await save(body)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("saves the authenticated author and offer details", async () => {
    expect((await save({ ...valid, negotiatorId: "spoofed" })).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ debtId: "debt-1", negotiatorId: "user-1", offerAmount: 1000, counterAmount: 1200, date: new Date("2026-09-16") }) }));
  });
});
