import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { negotiationStage } from "@/lib/negotiation-workflow";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { debt: { findFirst: mocks.find }, $transaction: mocks.transaction } }));
import { PATCH } from "@/app/api/opportunities/[id]/debts/[debtId]/negotiation-stage/route";
const save = (body: unknown) => PATCH(new NextRequest("http://localhost/api/stage", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "opp", debtId: "debt" }) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ session: { userId: "me" } }); mocks.access.mockResolvedValue(true);
  mocks.find.mockResolvedValue({ negotiationStatus: null, status: "ENROLLED" }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ debt: { updateMany: mocks.update }, negotiation: { create: mocks.create } }));
});
it("requires edit permission", async () => {
  mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 403 }) });
  expect((await save({})).status).toBe(403); expect(mocks.auth).toHaveBeenCalledWith("Debt.Edit"); expect(mocks.find).not.toHaveBeenCalled();
});
it("rejects inaccessible records", async () => { mocks.access.mockResolvedValue(false); expect((await save({})).status).toBe(404); expect(mocks.find).not.toHaveBeenCalled(); });
it("rejects invalid stages", async () => { expect((await save({ stage: "INVALID", previousStatus: null })).status).toBe(400); expect(mocks.transaction).not.toHaveBeenCalled(); });
it("rejects a debt from another opportunity", async () => { mocks.find.mockResolvedValue(null); expect((await save({ stage: "Negotiating", previousStatus: null })).status).toBe(404); expect(mocks.find).toHaveBeenCalledWith({ where: { id: "debt", opportunityId: "opp" } }); });
it("rejects stale changes", async () => { mocks.find.mockResolvedValue({ negotiationStatus: "Offer Submitted" }); expect((await save({ stage: "Negotiating", previousStatus: null })).status).toBe(409); expect(mocks.transaction).not.toHaveBeenCalled(); });
it("records stage and author in one transaction without altering debt balances or settlement state", async () => {
  expect((await save({ stage: "Negotiating", previousStatus: null, notes: "Spoke to creditor" })).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "debt", opportunityId: "opp", negotiationStatus: null }, data: { negotiationStatus: "Negotiating" } });
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ debtId: "debt", negotiatorId: "me", type: "STAGE_CHANGE", notes: "Stage changed: Not Started → Negotiating\nSpoke to creditor" }) });
});
it("handles concurrent updates without creating an audit entry", async () => { mocks.update.mockResolvedValue({ count: 0 }); expect((await save({ stage: "Negotiating", previousStatus: null })).status).toBe(409); expect(mocks.create).not.toHaveBeenCalled(); });
it("avoids duplicate stage entries", async () => { expect((await save({ stage: "Not Started", previousStatus: null })).status).toBe(200); expect(mocks.transaction).not.toHaveBeenCalled(); });
it("maps legacy settlement statuses and preserves unrecognized values", () => { expect(negotiationStage("Settled Payments")).toBe("Settled"); expect(negotiationStage("Counter Signature from Lender")).toBe("Agreement Pending"); expect(negotiationStage(null, "PAID")).toBe("Settled"); expect(negotiationStage("Custom status")).toBeNull(); });
