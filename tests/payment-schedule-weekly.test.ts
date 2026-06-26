import { describe, it, expect } from "vitest";
import { generatePaymentSchedule } from "@/lib/payment-schedule";

// Values verified live against the Salesforce "Payment Calculator" tab
// (Business Lead, Weekly, default fees: service $55, monthly bank $10,
// bank setup $15, setup $850, settlement 43% / program 20% / retainer 10%).
describe("weekly payment matches the Salesforce calculator", () => {
  it("$50,000 / 6 months → $1,430.22", () => {
    const r = generatePaymentSchedule({ totalDebt: 50000, termMonths: 6 });
    expect(r.totals.weeklyPayments).toBeCloseTo(1430.22, 2);
    expect(r.totals.totalSettlementAmt).toBe(21500);
    expect(r.totals.totalProgramFee).toBe(10000);
    expect(r.totals.retainerAmount).toBe(5000);
  });

  it("$100,000 / 6 months → $2,799.78", () => {
    const r = generatePaymentSchedule({ totalDebt: 100000, termMonths: 6 });
    expect(r.totals.weeklyPayments).toBeCloseTo(2799.78, 2);
  });
});
