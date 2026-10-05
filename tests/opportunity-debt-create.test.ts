import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/contracts/addendum", async importOriginal => ({...await importOriginal<typeof import("@/lib/contracts/addendum")>(),refreshAddendum:vi.fn()}));
import { NextRequest, NextResponse } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), opp: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { opportunity: { findUnique: m.opp }, debt: { create: m.create }, $transaction: (fn: (tx: unknown) => unknown) => fn({debt:{create:m.create}}) } }));
import { POST } from "@/app/api/opportunities/[id]/debts/route";
const body = { creditorName: "Test lender", originalBalance: 10000, currentBalance: 10000, enrolledBalance: 10000, paymentFrequency: "WEEKLY", paymentAmount: null, paymentStatus: "Current" };
const post = (data: unknown = body) => POST(new NextRequest("http://localhost/api/debts", { method: "POST", body: JSON.stringify(data) }), { params: Promise.resolve({ id: "opp" }) });
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ session: { userId: "rep" } }); m.access.mockResolvedValue(true); m.opp.mockResolvedValue({ id: "opp" }); m.create.mockResolvedValue({ id: "debt", opportunityId:"opp" }); });
it.each(["DAILY", "WEEKLY", "MONTHLY"])("creates a debt with %s frequency and preserves an unknown payment amount as null", async paymentFrequency => {
  expect((await post({ ...body, paymentFrequency })).status).toBe(201);
  expect(m.create.mock.calls[0][0].data).toMatchObject({ paymentFrequency, paymentAmount: null, sfDataJson: '{"Debt_Status__c":"Current"}' });
});
it("requires edit permission, not only a signed-in session", async () => {
  m.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
  expect((await post()).status).toBe(403); expect(m.auth).toHaveBeenCalledWith("Opportunity.Edit"); expect(m.create).not.toHaveBeenCalled();
});
it.each([{ ...body, paymentFrequency: "BI_WEEKLY" }, { ...body, paymentStatus: "PAID" }, null])("rejects unsupported or malformed creation data", async data => {
  expect((await post(data)).status).toBe(400); expect(m.create).not.toHaveBeenCalled();
});
