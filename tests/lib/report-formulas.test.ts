import { describe, expect, it } from "vitest";
import { evaluateFormula, validateFormulas, type ReportFormula } from "@/lib/reports/formulas";
const formula: ReportFormula = { key: "formula_margin", label: "Margin", left: "totalDebt", right: 100, operator: "percent" };
describe("report formulas", () => {
  it("validates numeric report fields and rejects arbitrary paths", () => {
    expect(validateFormulas([formula], "Opportunity")).toEqual([formula]);
    expect(() => validateFormulas([{ ...formula, left: "ssn" }], "Opportunity")).toThrow();
    expect(() => validateFormulas([{ ...formula, left: "constructor" }], "Opportunity")).toThrow();
    expect(() => validateFormulas([formula, formula], "Opportunity")).toThrow("unique");
  });
  it.each([["add", 150], ["subtract", -50], ["multiply", 5000], ["divide", .5], ["percent", 50]] as const)("evaluates %s", (operator, expected) => {
    expect(evaluateFormula({ ...formula, operator }, { totalDebt: 50 })).toBe(expected);
  });
  it("keeps missing inputs, zero division and overflow blank", () => {
    expect(evaluateFormula(formula, { totalDebt: null })).toBeNull();
    expect(evaluateFormula(formula, { totalDebt: "" })).toBeNull();
    expect(evaluateFormula({ ...formula, right: 0 }, { totalDebt: 50 })).toBeNull();
    expect(evaluateFormula({ ...formula, left: 1e308, right: 1e308, operator: "multiply" }, {})).toBeNull();
  });
});
