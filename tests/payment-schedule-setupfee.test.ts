import { describe, it, expect } from "vitest";
import {
  generatePaymentSchedule,
  resolveSetupFee,
} from "@/lib/payment-schedule";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("setup fee — SF SetupFee__mdt parity ($850 / $995 by legal plan)", () => {
  it("resolves 850 without a legal plan and 995 with one", () => {
    expect(resolveSetupFee(false)).toBe(850);
    expect(resolveSetupFee(null)).toBe(850);
    expect(resolveSetupFee(undefined)).toBe(850);
    expect(resolveSetupFee(true)).toBe(995);
  });

  it("legalPlanRequired raises setup fee and newTotalDebt by exactly $145", () => {
    const base = { totalDebt: 50000, termMonths: 6, firstPaymentDate: "2026-07-01" };
    const noPlan = generatePaymentSchedule({ ...base, legalPlanRequired: false });
    const withPlan = generatePaymentSchedule({ ...base, legalPlanRequired: true });

    expect(noPlan.totals.setupFee).toBe(850);
    expect(withPlan.totals.setupFee).toBe(995);
    expect(round2(withPlan.totals.newTotalDebtAmount - noPlan.totals.newTotalDebtAmount)).toBe(145);
  });

  it("an explicit setupFee override still wins over the legal-plan resolution", () => {
    const r = generatePaymentSchedule({
      totalDebt: 50000,
      termMonths: 6,
      legalPlanRequired: true,
      setupFee: 850,
    });
    expect(r.totals.setupFee).toBe(850);
  });
});
