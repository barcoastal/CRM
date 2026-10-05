import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/contracts/addendum", async importOriginal => ({...await importOriginal<typeof import("@/lib/contracts/addendum")>(),refreshAddendum:vi.fn()}));
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { debt: mocks, $transaction: (fn: (tx: unknown) => unknown) => fn({debt:mocks}) } }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: vi.fn(async () => ({ user: { id: "test" } })) }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.access }));
import { PATCH } from "@/app/api/debts/[id]/route";
import { debtPaymentStatus } from "@/lib/debt-payment-status";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.findUnique.mockResolvedValue({ id: "debt", opportunityId: "opp", paymentFrequency: "BI_WEEKLY", status: "NEGOTIATING", sfDataJson: JSON.stringify({ Debt_Status__c: "Current", Legal_Status__c: "Existing" }) });
  mocks.update.mockImplementation(async ({ data }) => ({ id: "debt", ...data }));
});

async function patch(body: unknown) {
  return PATCH(new NextRequest("http://localhost/api/debts/debt", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "debt" }) });
}

describe("opportunity inline debt edits", () => {
  it.each(["Current", "Default", "Reprieve"])("saves %s without changing the settlement stage or other imported fields", async (paymentStatus) => {
    expect((await patch({ paymentStatus })).status).toBe(200);
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(JSON.parse(data.sfDataJson)).toEqual({ Debt_Status__c: paymentStatus, Legal_Status__c: "Existing" });
  });
  it("rejects unsupported payment statuses", async () => {
    expect((await patch({ paymentStatus: "PAID" })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("changes only frequency on a frequency edit", async () => {
    expect((await patch({ paymentFrequency: "WEEKLY" })).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toEqual({ paymentFrequency: "WEEKLY" });
  });
  it("reads imported status and leaves missing status unselected", () => {
    expect(debtPaymentStatus('{"Debt_Status__c":"Reprieve"}')).toBe("Reprieve");
    expect(debtPaymentStatus(null)).toBe("");
    expect(debtPaymentStatus("invalid")).toBe("");
  });
});

it("blocks edits to another user's opportunity", async () => {
  mocks.access.mockResolvedValue(false);
  expect((await patch({ paymentFrequency: "WEEKLY" })).status).toBe(404);
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["BI_WEEKLY_NEW", "QUARTERLY", "", null])("rejects unsupported frequency %s", async (paymentFrequency) => {
  expect((await patch({ paymentFrequency })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("preserves an existing legacy frequency during an unrelated edit", async () => {
  expect((await patch({ paymentFrequency: "BI_WEEKLY", creditorName: "Updated lender" })).status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("currentBalance");
  expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("enrolledBalance");
});
it.each([{ originalBalance: -10 }, { currentBalance: "bad" }, { paymentAmount: -1 }, { creditorName: " " }])("rejects invalid values %j", async (body) => {
  expect((await patch(body)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
