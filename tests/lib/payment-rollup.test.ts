import { describe, it, expect } from "vitest";
import { rollupPayments } from "../../src/lib/payment-rollup";

describe("rollupPayments", () => {
  it("sums SUCCESS draft amounts into totalCollected", () => {
    const r = rollupPayments({
      drafts: [
        { status: "SUCCESS", amount: 500, settledAt: new Date("2026-03-01") },
        { status: "SUCCESS", amount: 500, settledAt: new Date("2026-04-01") },
        { status: "FAILED", amount: 500 },
        { status: "SCHEDULED", amount: 500 },
      ],
      fees: [],
      settlements: [],
    });
    expect(r.totalCollected).toBe(1000);
    expect(r.draftSuccessCount).toBe(2);
    expect(r.draftFailedCount).toBe(1);
    expect(r.lastDraftDate?.toISOString().substring(0, 10)).toBe("2026-04-01");
  });

  it("only counts CHARGED fees in totalFees", () => {
    const r = rollupPayments({
      drafts: [],
      fees: [
        { status: "CHARGED", amount: 250 },
        { status: "CHARGED", amount: 99 },
        { status: "PENDING", amount: 100 },
        { status: "WAIVED", amount: 50 },
        { status: "REFUNDED", amount: 25 },
      ],
      settlements: [],
    });
    expect(r.totalFees).toBe(349);
  });

  it("totals all settlements but only counts PAID into totalDisbursed", () => {
    const r = rollupPayments({
      drafts: [],
      fees: [],
      settlements: [
        { status: "PAID", settledAmount: 3000, savingsAmount: 4500 },
        { status: "PENDING_PAYOFF", settledAmount: 2000, savingsAmount: 1500 },
        { status: "CANCELLED", settledAmount: 1000, savingsAmount: 500 },
      ],
    });
    expect(r.totalSettled).toBe(6000);
    expect(r.totalSavings).toBe(6500);
    expect(r.totalDisbursed).toBe(3000);
  });

  it("handles empty inputs", () => {
    const r = rollupPayments({ drafts: [], fees: [], settlements: [] });
    expect(r.totalCollected).toBe(0);
    expect(r.totalFees).toBe(0);
    expect(r.totalSettled).toBe(0);
    expect(r.lastDraftDate).toBeNull();
  });
});
