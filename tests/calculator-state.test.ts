import { expect, it } from "vitest";
import { readCalculatorState } from "@/lib/payments/calculator-state";
const state = {
  version: 1,
  termMonths: 6,
  firstPaymentDate: "2026-10-02",
  weeklyPaymentDay: "Friday",
  paymentProcessor: "SAS Processor",
  splitRows: [
    {
      date: "2026-10-02",
      amount: 500,
      bankFee: 10,
      citadelFee: 0,
      setupFee: 0,
    },
    { date: "2026-10-09", amount: 500, bankFee: 0, citadelFee: 0, setupFee: 0 },
  ],
  skipped: [3],
  rowEdits: { "2": { date: "2026-10-16", amount: 200 } },
  extraRows: [],
};
it("round-trips split dates, amount edits, skipped rows and term after serialization", () => {
  expect(readCalculatorState(JSON.parse(JSON.stringify(state)))).toEqual(state);
});
it.each([
  null,
  {},
  { ...state, termMonths: 0 },
  { ...state, rowEdits: { "2": { date: "invalid", amount: 200 } } },
  { ...state, splitRows: [{ ...state.splitRows[0], amount: -1 }] },
])("rejects malformed saved calculations", (data) => {
  expect(readCalculatorState(data)).toBeNull();
});
