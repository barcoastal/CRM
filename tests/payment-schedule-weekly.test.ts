import { describe, it, expect } from "vitest";
import { generatePaymentSchedule } from "@/lib/payment-schedule";

// Ground truth: the LIVE Salesforce "Payment Calculator" tab (Business Lead,
// Weekly). Verified 2026-07-02 from the SF UI for a real $100,000 / 6-month
// SAS deal. These draft amounts are exactly what SAS charges via ACH, so they
// must match to the cent.
//
//   settlement 43% · program 20% · retainer 10%
//   service $55 · monthly bank $15 · bank setup $10 · citadel $145 · setup $850
//   → setup row (row 1) $10,875.00, then 23 weekly draws of $2,836.30
const SF_CASE = {
  totalDebt: 100000,
  termMonths: 6,
  settlementPercent: 43,
  programFeePercent: 20,
  retainerPercent: 10,
  serviceFeePerPeriod: 55,
  monthlyBankFee: 15,
  bankSetupFee: 10,
  citadelFee: 145,
  setupFee: 850,
  firstPaymentDate: "2026-03-13",
} as const;

describe("weekly payment matches the live Salesforce calculator", () => {
  it("$100,000 / 6 months → weekly draft $2,836.30", () => {
    const r = generatePaymentSchedule(SF_CASE);
    expect(r.totals.weeklyPayments).toBeCloseTo(2836.3, 2);
  });

  it("totalPaymentAmount pool = $65,235", () => {
    const r = generatePaymentSchedule(SF_CASE);
    expect(r.totals.totalPaymentAmount).toBeCloseTo(65235, 2);
  });

  it("setup row (row 1) drafts $10,875.00 (retainer $10,000 + setup $850 + $25 bank)", () => {
    const r = generatePaymentSchedule(SF_CASE);
    expect(r.rows[0].weeklyPaymentAmount).toBeCloseTo(10875, 2);
  });

  it("has one setup row + 23 weekly draws (24 rows)", () => {
    const r = generatePaymentSchedule(SF_CASE);
    expect(r.totals.weeklyRows).toBe(23);
    expect(r.rows.length).toBe(24);
    for (const row of r.rows.slice(1)) {
      expect(row.weeklyPaymentAmount).toBeCloseTo(2836.3, 2);
    }
  });
});
