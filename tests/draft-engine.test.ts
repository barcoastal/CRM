import { describe, it, expect } from "vitest";
import {
  splitDraft,
  applyTenKSplit,
  planSkip,
  planAmountEdit,
  nextBusinessDay,
  toBusinessDay,
  MAX_DRAFT_AMOUNT,
  type EngineDraft,
} from "@/lib/payments/draft-engine";

const mkDraft = (over: Partial<EngineDraft> = {}): EngineDraft => ({
  date: new Date("2026-07-13"), // a Monday
  amount: 18629.32,
  feeRetainer: 3000,
  feeProgram: 2000,
  feeSetup: 25,
  feeService: 55,
  feeBank: 15,
  feeLegal: 36.25,
  escrowAmount: 13498.07,
  ...over,
});

describe("$10K split rule", () => {
  it("splits $18,629.32 into $10,000 Mon + $8,629.32 Tue", () => {
    const kids = splitDraft(mkDraft(), "g1");
    expect(kids).toHaveLength(2);
    expect(kids[0].amount).toBe(10000);
    expect(kids[1].amount).toBeCloseTo(8629.32, 2);
    expect(kids[0].date.getDay()).toBe(1); // Monday
    expect(kids[1].date.getDay()).toBe(2); // Tuesday (consecutive business day)
  });

  it("weekly fees (service/bank/legal) ride the FIRST child only", () => {
    const kids = splitDraft(mkDraft(), "g1");
    expect(kids[0].feeService).toBe(55);
    expect(kids[0].feeBank).toBe(15);
    expect(kids[0].feeLegal).toBe(36.25);
    expect(kids[1].feeService).toBe(0);
    expect(kids[1].feeBank).toBe(0);
    expect(kids[1].feeLegal).toBe(0);
  });

  it("children sum exactly to the parent in every bucket", () => {
    const parent = mkDraft();
    const kids = splitDraft(parent, "g1");
    const sum = (k: keyof EngineDraft) => kids.reduce((s, c) => s + (c[k] as number), 0);
    expect(sum("amount")).toBeCloseTo(parent.amount, 2);
    expect(sum("feeRetainer")).toBeCloseTo(parent.feeRetainer, 2);
    expect(sum("feeSetup")).toBeCloseTo(parent.feeSetup, 2);
    expect(sum("feeProgram")).toBeCloseTo(parent.feeProgram, 2);
    expect(sum("escrowAmount")).toBeCloseTo(parent.escrowAmount, 2);
  });

  it("splits over weekends: Friday $25K -> Fri + Mon + Tue", () => {
    const kids = splitDraft(mkDraft({ date: new Date("2026-07-17"), amount: 25000, escrowAmount: 19868.75 }), "g1");
    expect(kids).toHaveLength(3);
    expect(kids.map((k) => k.date.getDay())).toEqual([5, 1, 2]); // Fri, Mon, Tue
  });

  it("leaves small drafts untouched", () => {
    const d = mkDraft({ amount: 4205.87, escrowAmount: 1000 });
    expect(splitDraft(d, "g1")).toHaveLength(1);
    expect(splitDraft(d, "g1")[0].splitGroupId).toBeUndefined();
  });

  it("applyTenKSplit only splits the over-limit rows", () => {
    const rows = [mkDraft({ amount: 5000, escrowAmount: 900 }), mkDraft(), mkDraft({ amount: 9999.99, escrowAmount: 5000 })];
    const out = applyTenKSplit(rows);
    expect(out).toHaveLength(4);
    expect(out.filter((d) => d.splitGroupId).length).toBe(2);
  });
});

describe("skip & push", () => {
  it("shifts all later drafts forward one period", () => {
    const pending = [
      { date: new Date("2026-07-13") },
      { date: new Date("2026-07-20") },
      { date: new Date("2026-07-27") },
    ];
    const { shifted } = planSkip(pending, 0);
    expect(shifted).toHaveLength(2);
    expect(shifted[0].newDate.toISOString().slice(0, 10)).toBe("2026-07-27");
    expect(shifted[1].newDate.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("skipping the last draft shifts nothing", () => {
    const { shifted } = planSkip([{ date: new Date("2026-07-13") }], 0);
    expect(shifted).toHaveLength(0);
  });
});

describe("amount edit + rebalance", () => {
  it("spreads the reduction over later drafts, totals preserved", () => {
    const pending = [
      { amount: 1000, fees: 100 },
      { amount: 1000, fees: 100 },
      { amount: 1000, fees: 100 },
    ];
    const { newAmounts } = planAmountEdit(pending, 0, 700);
    expect(newAmounts[0]).toBe(700);
    expect(newAmounts[1] + newAmounts[2]).toBeCloseTo(2300, 2);
    expect(newAmounts.reduce((s, n) => s + n, 0)).toBeCloseTo(3000, 2);
  });

  it("last draft absorbs rounding", () => {
    const pending = [
      { amount: 1000, fees: 0 },
      { amount: 1000, fees: 0 },
      { amount: 1000, fees: 0 },
      { amount: 1000, fees: 0 },
    ];
    const { newAmounts } = planAmountEdit(pending, 0, 899.99);
    expect(newAmounts.reduce((s, n) => s + n, 0)).toBeCloseTo(4000, 2);
  });

  it("refuses to push a payment below its weekly fees", () => {
    const pending = [
      { amount: 200, fees: 100 },
      { amount: 200, fees: 195 },
    ];
    expect(() => planAmountEdit(pending, 0, 190)).not.toThrow();
    expect(() => planAmountEdit(pending, 0, 400)).toThrow(/below/);
  });

  it("refuses when there is nothing later to rebalance into", () => {
    expect(() => planAmountEdit([{ amount: 100, fees: 0 }], 0, 50)).toThrow(/later/i);
  });
});

describe("business-day helpers", () => {
  it("nextBusinessDay skips weekends", () => {
    expect(nextBusinessDay(new Date("2026-07-17")).getDay()).toBe(1); // Fri -> Mon
  });
  it("toBusinessDay maps Saturday to Monday", () => {
    expect(toBusinessDay(new Date("2026-07-18")).getDay()).toBe(1);
  });
  it("MAX_DRAFT_AMOUNT is $10K", () => {
    expect(MAX_DRAFT_AMOUNT).toBe(10000);
  });
});
