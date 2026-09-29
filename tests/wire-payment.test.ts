import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  transaction: vi.fn(),
  wireFind: vi.fn(),
  wireCreate: vi.fn(),
  planFind: vi.fn(),
  planUpdate: vi.fn(),
  draft: vi.fn(),
  account: vi.fn(),
  audit: vi.fn(),
  task: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
import { POST } from "@/app/api/accounts/[id]/wire-payments/route";
import { wirePaymentSchema } from "@/lib/payments/wire-validation";
const body = {
  programPlanId: "plan",
  requestKey: "718cf671-3f70-4055-8758-158f345176e4",
  reference: "BANK-123",
  receivedAt: "2026-01-05",
  grossAmount: 1000,
  wireFee: 25,
  wireType: "Regular",
  legalFeePaid: false,
};
const call = (data: unknown = body) =>
  POST(
    new NextRequest("http://localhost/api/wire", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ id: "account" }) },
  );
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({
    session: { userId: "rep", permissions: ["Account.Edit", "Draft.Retry"] },
  });
  m.access.mockResolvedValue(true);
  m.planFind.mockResolvedValue({
    id: "plan",
    firstDraftDate: new Date("2026-01-01"),
  });
  m.draft.mockResolvedValue({ id: "draft" });
  m.wireCreate.mockResolvedValue({ id: "wire" });
  m.transaction.mockImplementation((fn) =>
    fn({
      wirePayment: { findUnique: m.wireFind, create: m.wireCreate },
      programPlan: { findFirst: m.planFind, update: m.planUpdate },
      draft: { create: m.draft },
      account: { update: m.account },
      auditLog: { create: m.audit },
      task: { create: m.task },
    }),
  );
});
it("records net escrow as an already completed wire with no outbound debit", async () => {
  expect((await call()).status).toBe(200);
  expect(m.draft.mock.calls[0][0].data).toMatchObject({
    amount: 975,
    escrowAmount: 975,
    status: "SUCCESS",
    kind: "WIRE",
    processorSyncStatus: "NOT_REQUIRED",
    processorReference: "BANK-123",
  });
  expect(m.planUpdate.mock.calls[0][0].data.completedPaymentsCount).toEqual({
    increment: 1,
  });
  expect(m.audit).toHaveBeenCalledTimes(1);
  expect(m.task).toHaveBeenCalledTimes(1);
  expect(m.transaction.mock.calls[0][1]).toEqual({
    isolationLevel: "Serializable",
  });
});
it("returns a prior identical request without creating a second payment", async () => {
  m.wireFind.mockResolvedValue({
    ...body,
    accountId: "account",
    receivedAt: new Date(body.receivedAt),
    id: "wire",
  });
  expect((await call()).status).toBe(200);
  expect(m.draft).not.toHaveBeenCalled();
});
it("rejects request-key reuse with a changed amount", async () => {
  m.wireFind.mockResolvedValue({
    ...body,
    accountId: "account",
    receivedAt: new Date(body.receivedAt),
    id: "wire",
    grossAmount: 2000,
  });
  expect((await call()).status).toBe(400);
  expect(m.draft).not.toHaveBeenCalled();
});
it("rejects duplicate bank references", async () => {
  m.transaction.mockRejectedValue({ code: "P2002" });
  expect((await call()).status).toBe(409);
});
it("requires payment permissions and record access", async () => {
  m.auth.mockResolvedValue({
    session: { userId: "rep", permissions: ["Account.Edit"] },
  });
  expect((await call()).status).toBe(403);
  expect(m.transaction).not.toHaveBeenCalled();
  m.auth.mockResolvedValue({
    session: { userId: "rep", permissions: ["Draft.Retry"] },
  });
  m.access.mockResolvedValue(false);
  expect((await call()).status).toBe(404);
});
it("rejects a plan from another account before writing", async () => {
  m.planFind.mockResolvedValue(null);
  expect((await call()).status).toBe(400);
  expect(m.draft).not.toHaveBeenCalled();
  expect(m.planFind.mock.calls[0][0].where.accountId).toBe("account");
});
it.each([
  { grossAmount: -1 },
  { grossAmount: 0 },
  { wireFee: 1001 },
  { grossAmount: 2.005 },
  { receivedAt: "2099-01-01" },
  { receivedAt: "2026-02-30" },
  { reference: " " },
  { wireType: "Other" },
])("validates received-wire data %j", (patch) =>
  expect(wirePaymentSchema.safeParse({ ...body, ...patch }).success).toBe(
    false,
  ),
);
