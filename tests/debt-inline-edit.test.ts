import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { debt: mocks } }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: vi.fn(async () => ({ user: { id: "test" } })) }));
import { PATCH } from "@/app/api/debts/[id]/route";
import { debtPaymentStatus } from "@/lib/debt-payment-status";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({ id: "debt", status: "NEGOTIATING", sfDataJson: JSON.stringify({ Debt_Status__c: "Current", Legal_Status__c: "Existing" }) });
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
