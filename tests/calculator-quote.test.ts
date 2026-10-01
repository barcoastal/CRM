import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/document-request", () => ({ appBaseUrl: () => "https://crm.example.test" }));
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";
import { computeSplit, validateSplit } from "@/lib/payments/retainer-split";
import { projectCalculation, collectibleRows, calculationError } from "@/lib/payments/calculator-projection";
import { readCalculatorState, type CalculatorState } from "@/lib/payments/calculator-state";
import { computeQuote, renderQuoteEmail } from "@/lib/quote-email";
const input = { totalDebt: 100000, termMonths: 6, firstPaymentDate: "2026-10-02", weeklyPaymentDay: "Friday" };
const base = generateRescheduleSchedule(input);
const splitParams = { retainerAmount: base.totals.retainerAmount, setupFee: base.totals.setupFee, citadelFee: 145, monthlyBankFee: 15, bankSetupFee: 10, weeklyDraft: base.totals.weeklyDraftAmount, firstPaymentDate: input.firstPaymentDate, weeklyPaymentDay: "Friday" };
function state(overrides: Partial<CalculatorState> = {}): CalculatorState {
  return { version: 1, termMonths: 6, firstPaymentDate: input.firstPaymentDate, weeklyPaymentDay: "Friday", paymentProcessor: "SAS Processor", splitRows: null, skipped: [], rowEdits: {}, extraRows: [], ...overrides };
}
const sum = (rows: { weeklyDraftAmount: number }[]) => Math.round(rows.reduce((s, r) => s + r.weeklyDraftAmount, 0) * 100) / 100;
describe("saved schedule and client quotes", () => {
  it("counts split children once, excludes their parent, and preserves the saved move option", () => {
    const saved = state({ splitRows: computeSplit(splitParams), moveDrafts: false });
    const projected = projectCalculation(base, saved);
    expect(projected[0]._summary).toBe(true);
    const payments = collectibleRows(projected);
    expect(payments.find(r => !r._child)?.date).toEqual(base.rows[1].date);
    const q = computeQuote({ ...input, savedState: saved });
    expect(q.programCost).toBe(sum(payments));
    expect(q.paymentSchedule).toHaveLength(payments.length);
    expect(readCalculatorState(JSON.parse(JSON.stringify(saved)))?.moveDrafts).toBe(false);
  });
  it("moves regular drafts after split payments when requested", () => {
    const splits = computeSplit(splitParams);
    const payments = collectibleRows(projectCalculation(base, state({ splitRows: splits, moveDrafts: true })));
    expect(payments.find(r => !r._child)!.date.getTime()).toBeGreaterThan(new Date(splits.at(-1)!.date).getTime());
  });
  it("defers a skipped payment once, preserving total cost and excluding the original date", () => {
    const saved = state({ skipped: [2] });
    const q = computeQuote({ ...input, savedState: saved });
    expect(q.programCost).toBe(sum(base.rows));
    expect(q.paymentSchedule.some(r => r.date === "2026-10-09")).toBe(false);
    expect(q.paymentSchedule.at(-1)!.date).toBe("2027-03-19");
  });
  it("uses edited cents and dates in the quote and escaped branded email", () => {
    const amount = base.rows[1].weeklyDraftAmount + 12.34;
    const saved = state({ rowEdits: { "2": { date: "2026-10-12", amount } } });
    const q = computeQuote({ ...input, savedState: saved });
    expect(q.programCost).toBeCloseTo(sum(base.rows) + 12.34, 2);
    expect(q.paymentSchedule).toContainEqual({ date: "2026-10-12", amount });
    const html = renderQuoteEmail({ figures: q, recipientName: "<script>alert(1)</script>", note: "<b>unsafe</b>" });
    expect(html).toContain("2026-10-12");
    expect(html).toContain(amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
  });
  it("preserves aggregate amount and fees across automatic $10K children", () => {
    const big = generateRescheduleSchedule({ ...input, totalDebt: 500000 });
    const rows = collectibleRows(projectCalculation(big, state()));
    expect(rows.every(r => r.weeklyDraftAmount <= 10000)).toBe(true);
    expect(sum(rows)).toBe(sum(big.rows));
    for (const key of ["programFee", "retainerFee", "setupFee", "serviceFee", "bankFee", "citadelFee", "escrowAmount"] as const)
      expect(rows.reduce((s, r) => s + r[key], 0)).toBeCloseTo(big.rows.reduce((s, r) => s + r[key], 0), 2);
  });
  it("rejects underfunded splits and edits below allocated fees", () => {
    const splitRows = computeSplit(splitParams); splitRows[0].amount -= 100;
    expect(calculationError(base, state({ splitRows }))).toContain("must cover");
    expect(calculationError(base, state({ rowEdits: { "2": { date: "2026-10-09", amount: 1 } } }))).toContain("allocated fees");
  });
  it("keeps setup allocation nonnegative when the setup fee exceeds one split payment", () => {
    const p = { ...splitParams, retainerAmount: 1000, weeklyDraft: 400 };
    const rows = computeSplit(p);
    expect(validateSplit(rows, 1000, 850)).toBeNull();
    expect(rows.every(r => r.amount >= r.setupFee + r.bankFee + r.citadelFee)).toBe(true);
    expect(rows.reduce((s, r) => s + r.setupFee, 0)).toBe(850);
  });
});

it("preserves exact calendar dates across DST and the $10K weekend split", () => {
  const schedule = generateRescheduleSchedule({ ...input, totalDebt: 200000, firstPaymentDate: "2026-10-30" });
  const payments = collectibleRows(projectCalculation(schedule, state({ firstPaymentDate: "2026-10-30" })));
  expect(payments.slice(0, 3).map(r => r.date.toISOString().slice(0, 10))).toEqual(["2026-10-30", "2026-11-02", "2026-11-03"]);
  expect(payments.find(r => r.index === 2)?.date.toISOString().slice(0, 10)).toBe("2026-11-06");
});

it("rejects even a one-cent shortage in split principal", () => {
  const rows = computeSplit(splitParams); rows[0].amount = Math.round((rows[0].amount - 0.01) * 100) / 100;
  expect(validateSplit(rows, splitParams.retainerAmount, splitParams.setupFee)).toContain("must cover");
});
