import { z } from "zod";
import { getObjectMetadata } from "./object-metadata";
const operand = z.union([z.number().finite(), z.string().min(1).max(160), z.object({literal:z.union([z.string().max(200),z.boolean(),z.number().finite()])})]);
export const formulaSchema = z.object({
  key: z.string().regex(/^formula_[a-zA-Z0-9_]{1,50}$/), label: z.string().trim().min(1).max(80),
  left: operand, right: operand,
  operator: z.enum(["add", "subtract", "multiply", "divide", "percent", "daysBetween", "ageDays", "if"]),
  scope: z.enum(["row", "summary"]).optional(),
  comparison: z.enum(["equals", "not", "gt", "gte", "lt", "lte"]).optional(),
  whenTrue: operand.optional(), whenFalse: operand.optional(),
});
export type ReportFormula = z.infer<typeof formulaSchema>;
export function formulaDependencies(formula: ReportFormula): string[] {
  return [formula.left, ...(formula.operator === "ageDays" ? [] : [formula.right]), ...(formula.operator === "if" ? [formula.whenTrue, formula.whenFalse] : [])].filter((v): v is string => typeof v === "string");
}
export function validateFormulas(value: unknown, objectType: string): ReportFormula[] {
  const parsed = z.array(formulaSchema).max(10).parse(value ?? []);
  const fields = getObjectMetadata(objectType)?.fields ?? [];
  const keys = new Set<string>();
  for (const f of parsed) {
    if (keys.has(f.key)) throw new Error("Formula keys must be unique");
    keys.add(f.key);
    if (f.operator === "if" && (!f.comparison || f.whenTrue === undefined || f.whenFalse === undefined)) throw new Error("IF requires a comparison and both result values");
    const allowed = new Set(fields.filter(field => field.type === "number").map(field => field.key));
    if (f.operator === "daysBetween" || f.operator === "ageDays") {
      if (f.scope === "summary") throw new Error("Date calculations apply to individual rows");
      const dates = new Set(fields.filter(field => field.type === "date").map(field => field.key));
      if (typeof f.left !== "string" || !dates.has(f.left) || (f.operator === "daysBetween" && (typeof f.right !== "string" || !dates.has(f.right)))) throw new Error("Date formulas require date fields");
      continue;
    }
    for (const key of formulaDependencies(f)) {
      if (f.scope === "summary") {
        if (key === "_count") continue;
        const match = key.match(/^(.*)_(sum|avg|count)$/);
        if (!match || !allowed.has(match[1])) throw new Error(`Choose a numeric total for summary formula: ${key}`);
      } else if (f.operator === "if" && [f.left,f.right].includes(key) && fields.some(field=>field.key===key)) { continue; } else if (!allowed.has(key)) throw new Error(`Formula field must be a supported numeric field: ${key}`);
    }
  }
  return parsed;
}
export function evaluateFormula(f: ReportFormula, row: Record<string, unknown>, now = new Date()): number | null {
  const resolve = (v: ReportFormula["left"] | undefined): number | null => {
    const value = typeof v === "object" ? v.literal : typeof v === "number" ? v : v ? row[v] : null;
    if (value == null || value === "") return null;
    const number = Number(value); return Number.isFinite(number) ? number : null;
  };
  if (f.operator === "daysBetween" || f.operator === "ageDays") {
    const a = row[String(f.left)], b = f.operator === "ageDays" ? now : row[String(f.right)];
    if (a == null || b == null) return null;
    const result = (new Date(String(b)).getTime() - new Date(String(a)).getTime()) / 86400000;
    return Number.isFinite(result) ? Math.floor(result) : null;
  }
  if (f.operator === "if") {
    const raw = (v: ReportFormula["left"]) => typeof v === "object" ? v.literal : typeof v === "number" ? v : row[v];
    const a = raw(f.left), b = raw(f.right);
    if (a == null || b == null) return null;
    let comparison: number;
    if (typeof a === "number") { if (!Number.isFinite(Number(b))) return null; comparison = a - Number(b); }
    else if (a instanceof Date) { comparison = a.getTime() - new Date(String(b)).getTime(); if (!Number.isFinite(comparison)) return null; }
    else comparison = String(a).localeCompare(String(b));
    const condition = f.comparison === "equals" ? comparison === 0 : f.comparison === "not" ? comparison !== 0 : f.comparison === "gt" ? comparison > 0 : f.comparison === "gte" ? comparison >= 0 : f.comparison === "lt" ? comparison < 0 : comparison <= 0;
    return resolve(condition ? f.whenTrue : f.whenFalse);
  }
  const a = resolve(f.left), b = resolve(f.right);
  if (a === null || b === null) return null;
  const result = f.operator === "add" ? a + b : f.operator === "subtract" ? a - b : f.operator === "multiply" ? a * b : b === 0 ? NaN : a / b * (f.operator === "percent" ? 100 : 1);
  return Number.isFinite(result) ? result : null;
}
