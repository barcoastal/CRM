/**
 * SF-style Validation Rules evaluator.
 *
 * Rules are stored as a JSON AST per ValidationRule row. At runtime, the
 * trigger middleware calls runRulesFor() right before each write. The
 * configured condition is evaluated against the proposed record; when the
 * condition evaluates TRUE that means "validation failed" (SF convention),
 * and we surface the configured errorMessage so the trigger can throw.
 *
 * Supported operators:
 *   equals, notEquals, contains, startsWith, endsWith,
 *   gt, gte, lt, lte, isNull, isNotNull, in, notIn
 *
 * Field paths are dotted (e.g. "owner.name") and resolved with the same
 * helper used by the Path "Key Fields" panel so behavior stays consistent.
 */

import { prisma } from "@/lib/prisma";
import { resolveFieldValue } from "@/lib/path/field-values";

export type Operator =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "in"
  | "notIn";

export const OPERATORS: Operator[] = [
  "equals",
  "notEquals",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "isNull",
  "isNotNull",
  "in",
  "notIn",
];

export const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  isNull: "is empty",
  isNotNull: "is not empty",
  in: "is one of",
  notIn: "is not one of",
};

export interface ConditionRow {
  field: string;
  operator: Operator | string;
  value?: unknown;
}

export interface Condition {
  kind: "and" | "or";
  conditions: ConditionRow[];
}

export type EvalResult =
  | { ok: true }
  | { ok: false; ruleName: string; ruleId: string; message: string; fieldName?: string };

/**
 * Coerce a value into something comparable. Strings are returned trimmed.
 * Numbers parse via Number(). Dates pass through. JSON-stringified blobs
 * stay as their string form.
 */
function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v === null || v === undefined || v === "") return NaN;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return n;
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x));
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Apply one operator. Returns true when the row's predicate matches.
 */
export function applyOperator(
  operator: string,
  fieldValue: unknown,
  ruleValue: unknown,
): boolean {
  switch (operator) {
    case "equals":
      return asString(fieldValue) === asString(ruleValue);
    case "notEquals":
      return asString(fieldValue) !== asString(ruleValue);
    case "contains":
      return asString(fieldValue).toLowerCase().includes(asString(ruleValue).toLowerCase());
    case "startsWith":
      return asString(fieldValue).toLowerCase().startsWith(asString(ruleValue).toLowerCase());
    case "endsWith":
      return asString(fieldValue).toLowerCase().endsWith(asString(ruleValue).toLowerCase());
    case "gt": {
      const a = asNumber(fieldValue);
      const b = asNumber(ruleValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return a > b;
    }
    case "gte": {
      const a = asNumber(fieldValue);
      const b = asNumber(ruleValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return a >= b;
    }
    case "lt": {
      const a = asNumber(fieldValue);
      const b = asNumber(ruleValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return a < b;
    }
    case "lte": {
      const a = asNumber(fieldValue);
      const b = asNumber(ruleValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return a <= b;
    }
    case "isNull":
      return isEmpty(fieldValue);
    case "isNotNull":
      return !isEmpty(fieldValue);
    case "in": {
      const list = asList(ruleValue).map((x) => x.toLowerCase());
      return list.includes(asString(fieldValue).toLowerCase());
    }
    case "notIn": {
      const list = asList(ruleValue).map((x) => x.toLowerCase());
      return !list.includes(asString(fieldValue).toLowerCase());
    }
    default:
      return false;
  }
}

/**
 * Walk the condition AST. With `kind: "and"` every row must match. With
 * `kind: "or"` at least one row must match. An empty conditions list is
 * treated as "does not match" so an empty rule never blocks writes.
 *
 * Field paths that start with `sfDataJson.` are pulled from the parsed
 * sfDataJson blob when the underlying column is a JSON string. This mirrors
 * the report builder behavior for SF-snapshot fields.
 */
export function evaluate(
  condition: Condition,
  record: Record<string, unknown>,
): boolean {
  const rows = Array.isArray(condition?.conditions) ? condition.conditions : [];
  if (rows.length === 0) return false;
  const kind = condition.kind === "or" ? "or" : "and";

  const resolved: boolean[] = rows.map((row) => {
    const fieldValue = resolveFieldPath(record, row.field);
    return applyOperator(row.operator, fieldValue, row.value);
  });

  if (kind === "or") return resolved.some(Boolean);
  return resolved.every(Boolean);
}

/**
 * Resolve a dotted path against a record. Adds two affordances on top of
 * the generic helper:
 *   1. sfDataJson.* paths parse the JSON column if it's a string.
 *   2. ISO date strings get coerced to Date so number comparisons work.
 */
export function resolveFieldPath(
  record: Record<string, unknown>,
  field: string,
): unknown {
  if (!field) return undefined;
  // sfDataJson lives as a JSON-encoded string on lead/opp/account; parse it
  // lazily so rule authors can target Salesforce fields.
  if (field.startsWith("sfDataJson.")) {
    const raw = record.sfDataJson;
    let parsed: Record<string, unknown> = {};
    if (typeof raw === "string") {
      try {
        const v = JSON.parse(raw);
        if (v && typeof v === "object") parsed = v as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    } else if (raw && typeof raw === "object") {
      parsed = raw as Record<string, unknown>;
    }
    const sub = field.slice("sfDataJson.".length);
    return resolveFieldValue(parsed, sub);
  }
  return resolveFieldValue(record, field);
}

/**
 * Load active rules for the entity + phase, evaluate each, return the first
 * failure. Returns { ok: true } when nothing matches.
 *
 * DB errors are swallowed so a broken rule (or a transient connectivity
 * blip) never blocks a write. Individual rules that throw during evaluation
 * are skipped with a console warning so one malformed rule cannot poison
 * the whole batch.
 */
export async function runRulesFor(
  entityType: string,
  record: Record<string, unknown>,
  phase: "insert" | "update",
): Promise<EvalResult> {
  let rules: Array<{
    id: string;
    name: string;
    errorMessage: string;
    errorFieldName: string | null;
    condition: unknown;
    fireOn: string;
  }> = [];
  try {
    rules = await prisma.validationRule.findMany({
      where: {
        entityType,
        isActive: true,
        OR: [{ fireOn: "both" }, { fireOn: phase }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        errorMessage: true,
        errorFieldName: true,
        condition: true,
        fireOn: true,
      },
    });
  } catch (err) {
    // If the table isn't ready yet or the DB hiccups, skip validation
    // rather than break the write.
    if (process.env["NODE_ENV"] !== "production") {
      console.warn("[validation-rules] failed to load rules", err);
    }
    return { ok: true };
  }

  for (const rule of rules) {
    let cond: Condition;
    try {
      cond = normalizeCondition(rule.condition);
    } catch {
      continue;
    }
    try {
      const failed = evaluate(cond, record);
      if (failed) {
        return {
          ok: false,
          ruleId: rule.id,
          ruleName: rule.name,
          message: rule.errorMessage,
          fieldName: rule.errorFieldName ?? undefined,
        };
      }
    } catch (err) {
      // Skip rules that blow up during evaluation. Log for debugging.
      if (process.env["NODE_ENV"] !== "production") {
        console.warn(`[validation-rules] rule ${rule.id} threw`, err);
      }
      continue;
    }
  }

  return { ok: true };
}

/**
 * Accept condition payloads from JSON columns or already-parsed objects and
 * return a strict Condition value. Throws on totally unusable shapes.
 */
export function normalizeCondition(raw: unknown): Condition {
  let v: unknown = raw;
  if (typeof v === "string") v = JSON.parse(v);
  if (!v || typeof v !== "object") throw new Error("invalid condition");
  const obj = v as Record<string, unknown>;
  const kind = obj.kind === "or" ? "or" : "and";
  const conds = Array.isArray(obj.conditions) ? obj.conditions : [];
  const rows: ConditionRow[] = [];
  for (const c of conds) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const field = typeof row.field === "string" ? row.field : "";
    const operator = typeof row.operator === "string" ? row.operator : "";
    if (!field || !operator) continue;
    rows.push({ field, operator, value: row.value });
  }
  return { kind, conditions: rows };
}
