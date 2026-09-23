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

it("supports IF conditions on rows and summary totals",()=>{
  const row={totalDebt:500};
  const conditional={key:"formula_flag",label:"Flag",operator:"if" as const,left:"totalDebt",right:100,comparison:"gte" as const,whenTrue:1,whenFalse:0};
  expect(validateFormulas([conditional],"Opportunity")).toHaveLength(1);
  expect(evaluateFormula(conditional,row)).toBe(1);
  expect(evaluateFormula(conditional,{totalDebt:50})).toBe(0);
  expect(evaluateFormula({...conditional,scope:"summary",left:"totalDebt_sum"},{totalDebt_sum:900})).toBe(1);
  expect(()=>validateFormulas([{...conditional,whenTrue:undefined}],"Opportunity")).toThrow();
});
it("calculates whole elapsed days and age using a fixed report time",()=>{
  const dateFormula={key:"formula_days",label:"Days",operator:"daysBetween" as const,left:"createdAt",right:"closeDate"};
  expect(validateFormulas([dateFormula],"Opportunity")).toHaveLength(1);
  expect(evaluateFormula(dateFormula,{createdAt:"2026-09-01T12:00:00Z",closeDate:"2026-09-04T12:00:00Z"})).toBe(3);
  expect(evaluateFormula({...dateFormula,operator:"ageDays"},{createdAt:"2026-09-01T12:00:00Z"},new Date("2026-09-05T12:00:00Z"))).toBe(4);
  expect(evaluateFormula(dateFormula,{createdAt:null,closeDate:"2026-09-04"})).toBeNull();
});
it("supports status-based IF conditions with literal comparison values",()=>{
  const f={key:"formula_won",label:"Won amount",operator:"if" as const,left:"stage",right:{literal:"Closed Won"},comparison:"equals" as const,whenTrue:"amount",whenFalse:0};
  expect(validateFormulas([f],"Opportunity")).toHaveLength(1);
  expect(evaluateFormula(f,{stage:"Closed Won",amount:500})).toBe(500);
  expect(evaluateFormula(f,{stage:"Working",amount:500})).toBe(0);
});
