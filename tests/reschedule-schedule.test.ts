import { describe, it, expect } from "vitest";
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";

// Verified live against SF's Opportunity Reschedule Program calculator.
describe("reschedule schedule matches Salesforce", () => {
  it("$150,000 / 6mo / citadel $145 → weekly draft $4,205.87", () => {
    const r = generateRescheduleSchedule({
      totalDebt: 150000,
      termMonths: 6,
      citadelFee: 145,
    });
    expect(r.totals.weeklyDraftAmount).toBeCloseTo(4205.87, 2);
    expect(r.totals.settlementAmount).toBe(64500);
    expect(r.totals.programFeeAmount).toBe(30000);
    expect(r.totals.retainerAmount).toBe(15000);
    expect(r.totals.noOfPayments).toBe(23);
    // setup row = retainer + setup + $25 bank (bank setup $10 + first month $15),
    // matching the SF setup row (verified 2026-07-02 from the account screenshot).
    expect(r.rows[0].weeklyDraftAmount).toBe(15875);
    expect(r.rows[0].retainerFee).toBe(15000);
    expect(r.rows[0].setupFee).toBe(850);
    expect(r.rows[0].bankFee).toBe(25);
    // first weekly row carries only the $15 monthly bank fee
    expect(r.rows[1].bankFee).toBe(15);
  });

  it("without citadel, falls to service×(term×4−1) base", () => {
    const r = generateRescheduleSchedule({ totalDebt: 150000, termMonths: 6 });
    // 64500 + 30000 + 55*23 + 15*6 + 10 = 95865 ; /23 = 4168.04
    expect(r.totals.weeklyDraftAmount).toBeCloseTo(4168.04, 2);
  });

  // Full per-row breakdown, verified to the cent against the live SF screenshot
  // ($100k / 6mo / citadel $145, first payment 2026-03-13).
  it("$100k row breakdown matches SF (program $1,841.91, escrow, running balance)", () => {
    const r = generateRescheduleSchedule({
      totalDebt: 100000,
      termMonths: 6,
      citadelFee: 145,
      firstPaymentDate: "2026-03-13",
    });
    // Row 2 (first weekly): bank $15 + citadel $145, escrow $779.39
    expect(r.rows[1].programFee).toBeCloseTo(1841.91, 2);
    expect(r.rows[1].bankFee).toBeCloseTo(15, 2);
    expect(r.rows[1].citadelFee).toBeCloseTo(145, 2);
    expect(r.rows[1].escrowAmount).toBeCloseTo(779.39, 2);
    expect(r.rows[1].runningBalance).toBeCloseTo(779.39, 2);
    // Row 3: no bank/citadel, so escrow absorbs them → $939.39
    expect(r.rows[2].programFee).toBeCloseTo(1841.91, 2);
    expect(r.rows[2].escrowAmount).toBeCloseTo(939.39, 2);
    expect(r.rows[2].runningBalance).toBeCloseTo(1718.78, 2);
  });
});
