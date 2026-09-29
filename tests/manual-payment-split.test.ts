import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  drain: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    draft: { findUnique: m.find, update: m.update, create: m.create },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/payment-processors/outbound", () => ({
  drainProcessorQueues: m.drain,
}));
import { splitDraftManual } from "@/lib/payments/draft-mutations";
const draft = {
  id: "draft",
  programPlanId: "plan",
  debitScheduleId: null,
  amount: 100,
  status: "SCHEDULED",
  feeService: 10,
  feeBank: 0,
  feeLegal: 0,
  feeRetainer: 20,
  feeSetup: 0,
  feeProgram: 20,
  escrowAmount: 50,
  kind: "SCHEDULED",
  updatedAt: new Date("2026-01-01"),
};
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue(draft);
  m.update.mockResolvedValue({ id: "draft" });
  m.create.mockResolvedValue({ id: "child" });
  m.transaction.mockImplementation((rows) => Promise.all(rows));
});
const part = (amount: number, day = "2026-10-02") => ({
  amount,
  date: new Date(day),
});
it("allocates fees in actual date order and preserves the original cents", async () => {
  await splitDraftManual("draft", [part(40, "2026-10-09"), part(60)]);
  const first = m.update.mock.calls[0][0];
  const second = m.create.mock.calls[0][0];
  expect(first.where).toMatchObject({
    id: "draft",
    updatedAt: draft.updatedAt,
    status: { in: ["SCHEDULED", "RETRYING"] },
  });
  expect(first.data).toMatchObject({
    amount: 60,
    feeService: 10,
    feeRetainer: 20,
    feeProgram: 20,
    escrowAmount: 10,
  });
  expect(second.data).toMatchObject({
    amount: 40,
    feeService: 0,
    escrowAmount: 40,
  });
});
it("rejects insufficient fees on the earliest date even if another part was entered first", async () => {
  await expect(
    splitDraftManual("draft", [part(95, "2026-10-09"), part(5)]),
  ).rejects.toThrow("fees");
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects a one-cent total mismatch", async () => {
  await expect(
    splitDraftManual("draft", [part(50), part(50.01)]),
  ).rejects.toThrow("must match");
});
it.each([Infinity, -1, 0, 10000.01, 0.001])(
  "rejects invalid part amount %s",
  async (amount) => {
    await expect(
      splitDraftManual("draft", [part(amount), part(50)]),
    ).rejects.toThrow("Each split");
  },
);
it("does not split a completed draft", async () => {
  m.find.mockResolvedValue({ ...draft, status: "SUCCESS" });
  await expect(splitDraftManual("draft", [part(50), part(50)])).rejects.toThrow(
    "Only pending",
  );
  expect(m.transaction).not.toHaveBeenCalled();
});
