import { beforeEach, expect, it, vi } from "vitest";
import {
  amendmentSchema,
  amendmentView,
  applyOpportunityAmendment,
} from "@/lib/opportunity-amendment";
import type { Prisma } from "@/generated/prisma/client";
const debt = {
  id: "debt",
  creditorName: "Lender",
  originalBalance: 10000,
  currentBalance: 9000,
  enrolledBalance: 10000,
  paymentAmount: 100,
  paymentFrequency: "DAILY",
  status: "ENROLLED",
  sfDataJson: '{"Debt_Status__c":"Current","Legal_Status__c":"Preserve"}',
  updatedAt: new Date("2026-01-01"),
};
const draft = {
  id: "draft",
  amount: 500,
  scheduledDate: new Date("2026-10-02"),
  status: "SCHEDULED",
  feeRetainer: 0,
  feeProgram: 50,
  feeSetup: 0,
  feeService: 20,
  feeBank: 5,
  feeLegal: 0,
  escrowAmount: 425,
  updatedAt: new Date("2026-01-01"),
};
let opp: Parameters<typeof amendmentView>[0];
let tx: Prisma.TransactionClient;
let writes: {
  debt: ReturnType<typeof vi.fn>;
  draft: ReturnType<typeof vi.fn>;
  opportunity: ReturnType<typeof vi.fn>;
  history: ReturnType<typeof vi.fn>;
  audit: ReturnType<typeof vi.fn>;
  calc: ReturnType<typeof vi.fn>;
  plan: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  opp = {
    id: "opp",
    version: "1.0",
    updatedAt: new Date("2026-01-01"),
    firstDraftDate: new Date("2026-10-02"),
    client: null,
    debts: [structuredClone(debt)],
    programPlans: [
      {
        id: "plan",
        status: "ACTIVE",
        termMonths: 6,
        drafts: [
          structuredClone(draft),
          { ...structuredClone(draft), id: "completed", status: "SUCCESS" },
        ],
      },
    ],
    paymentCalculations: [],
  } as unknown as typeof opp;
  writes = {
    debt: vi.fn(),
    draft: vi.fn(),
    opportunity: vi.fn(),
    history: vi.fn(),
    audit: vi.fn(),
    calc: vi.fn(),
    plan: vi.fn(),
  };
  tx = {
    opportunity: {
      findUnique: vi.fn(async () => opp),
      update: writes.opportunity,
    },
    debt: { update: writes.debt, create: writes.debt },
    draft: { update: writes.draft, findMany: vi.fn(async () => [draft]) },
    programPlan: { update: writes.plan },
    opportunityHistory: { create: writes.history },
    auditLog: { create: writes.audit },
    opportunityPaymentCalculation: { create: writes.calc },
  } as unknown as Prisma.TransactionClient;
});
function input() {
  const v = amendmentView(opp);
  return amendmentSchema.parse({
    revision: v.revision,
    reason: "Client requested lower payment",
    termMonths: v.termMonths,
    firstPaymentDate: v.firstPaymentDate,
    debts: v.debts.map(({ locked: _locked, ...d }) => d),
    payments: v.payments.map(({ id, amount, date }) => ({ id, amount, date })),
  });
}
it("saves debt and pending payment changes with version history and preserves other imported fields", async () => {
  const data = input();
  data.debts[0].currentBalance = 8000;
  data.payments[0].amount = 400;
  const result = await applyOpportunityAmendment(tx, "opp", data, "rep", true);
  expect(result).toEqual({ version: "1.1", changedPlanIds: ["plan"] });
  expect(writes.draft).toHaveBeenCalledTimes(1);
  expect(writes.draft.mock.calls[0][0]).toMatchObject({
    where: { id: "draft" },
    data: { amount: 400, escrowAmount: 325, processorSyncStatus: "PENDING" },
  });
  expect(
    JSON.parse(writes.debt.mock.calls[0][0].data.sfDataJson).Legal_Status__c,
  ).toBe("Preserve");
  expect(writes.opportunity.mock.calls[0][0].data).toMatchObject({
    version: "1.1",
    totalDebt: 10000,
    currentTotalDebt: 8000,
    currentWeeklyPayment: 500,
  });
  expect(writes.history).toHaveBeenCalledTimes(1);
  expect(writes.audit).toHaveBeenCalledTimes(1);
});
it("refuses a stale edit before any write", async () => {
  const data = input();
  opp.debts[0].currentBalance = 7000;
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", true),
  ).rejects.toThrow("changed while");
  expect(writes.debt).not.toHaveBeenCalled();
});
it("does not bump a version for an empty amendment", async () => {
  await expect(
    applyOpportunityAmendment(tx, "opp", input(), "rep", true),
  ).rejects.toThrow("Make a debt or payment change");
  expect(writes.opportunity).not.toHaveBeenCalled();
});
it("protects completed payments even if their IDs are submitted", async () => {
  const data = input();
  data.payments[0].id = "completed";
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", true),
  ).rejects.toThrow("payment schedule changed");
  expect(writes.draft).not.toHaveBeenCalled();
});
it("protects settled debts", async () => {
  opp.debts[0].status = "SETTLED";
  const data = input();
  data.debts[0].originalBalance += 1;
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", true),
  ).rejects.toThrow("cannot be changed");
});
it("requires payment-edit permission for payment changes", async () => {
  const data = input();
  data.payments[0].amount = 400;
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", false),
  ).rejects.toThrow("permission");
  expect(writes.draft).not.toHaveBeenCalled();
});
it("rejects an amount below allocated fees", async () => {
  const data = input();
  data.payments[0].amount = 50;
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", true),
  ).rejects.toThrow("allocated fees");
});
it("keeps old debts when adding a new one", async () => {
  const data = input();
  data.debts.push({
    ...data.debts[0],
    id: undefined,
    creditorName: "New lender",
  });
  await applyOpportunityAmendment(tx, "opp", data, "rep", true);
  expect(writes.debt.mock.calls[0][0].data).toMatchObject({
    opportunityId: "opp",
    programPlanId: "plan",
    creditorName: "New lender",
  });
  expect(writes.opportunity.mock.calls[0][0].data.totalDebt).toBe(20000);
});
it("rejects debt removal and duplicate payment rows", async () => {
  const data = input();
  data.debts = [];
  await expect(
    applyOpportunityAmendment(tx, "opp", data, "rep", true),
  ).rejects.toThrow("preserved");
  const next = input();
  next.payments.push(next.payments[0]);
  await expect(
    applyOpportunityAmendment(tx, "opp", next, "rep", true),
  ).rejects.toThrow("schedule changed");
});
