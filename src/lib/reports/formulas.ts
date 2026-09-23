import { z } from "zod";
import { getObjectMetadata } from "./object-metadata";

const operand = z.union([z.number().finite(), z.string().min(1).max(160)]);
export const formulaSchema = z.object({
  key: z.string().regex(/^formula_[a-zA-Z0-9_]{1,50}$/),
  label: z.string().trim().min(1).max(80),
  left: operand,
  operator: z.enum(["add", "subtract", "multiply", "divide", "percent"]),
  right: operand,
});
export type ReportFormula = z.infer<typeof formulaSchema>;
export function validateFormulas(value: unknown, objectType: string): ReportFormula[] {
  const parsed = z.array(formulaSchema).max(10).parse(value ?? []);
  const keys = new Set<string>();
  const numeric = new Set(getObjectMetadata(objectType)?.fields.filter(f => f.type === "number" && f.source !== "computed").map(f => f.key));
  for (const formula of parsed) {
    if (keys.has(formula.key)) throw new Error("Formula keys must be unique");
    keys.add(formula.key);
    for (const field of [formula.left, formula.right]) {
      if (typeof field === "string" && !numeric.has(field)) throw new Error(`Formula field must be a supported numeric field: ${field}`);
    }
  }
  return parsed;
}
export function evaluateFormula(formula: ReportFormula, row: Record<string, unknown>): number | null {
  const resolve = (operand: string | number) => {
    const value = typeof operand === "number" ? operand : row[operand];
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const a = resolve(formula.left), b = resolve(formula.right);
  if (a === null || b === null) return null;
  let result: number;
  switch (formula.operator) {
    case "add": result = a + b; break;
    case "subtract": result = a - b; break;
    case "multiply": result = a * b; break;
    case "divide": result = b === 0 ? NaN : a / b; break;
    case "percent": result = b === 0 ? NaN : a / b * 100; break;
  }
  return Number.isFinite(result) ? result : null;
}
