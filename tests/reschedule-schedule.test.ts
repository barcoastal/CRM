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
    // setup row = retainer + setup
    expect(r.rows[0].weeklyDraftAmount).toBe(15850);
    expect(r.rows[0].retainerFee).toBe(15000);
    expect(r.rows[0].setupFee).toBe(850);
  });

  it("without citadel, falls to service×(term×4−1) base", () => {
    const r = generateRescheduleSchedule({ totalDebt: 150000, termMonths: 6 });
    // 64500 + 30000 + 55*23 + 15*6 + 10 = 95865 ; /23 = 4168.04
    expect(r.totals.weeklyDraftAmount).toBeCloseTo(4168.04, 2);
  });
});
