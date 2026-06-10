/**
 * Condition AST evaluator. Mirrors the shape used by ValidationRule so admins
 * can author criteria once and reuse the same builder UI across features.
 *
 * Tree shape:
 *   { kind: "and" | "or", conditions: [ConditionLeaf | ConditionGroup, ...] }
 *
 * Leaf shape:
 *   { field: "status", operator: "equals", value: "Active" }
 */

import type { ConditionGroup, ConditionLeaf } from "./nodes";

function getPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim());
  return [v];
}

function evalLeaf(leaf: ConditionLeaf, record: Record<string, unknown>): boolean {
  const actual = getPath(record, leaf.field);
  const expected = leaf.value;
  switch (leaf.operator) {
    case "equals":
      return String(actual ?? "") === String(expected ?? "");
    case "notEquals":
      return String(actual ?? "") !== String(expected ?? "");
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "startsWith":
      return String(actual ?? "").toLowerCase().startsWith(String(expected ?? "").toLowerCase());
    case "endsWith":
      return String(actual ?? "").toLowerCase().endsWith(String(expected ?? "").toLowerCase());
    case "gt": {
      const a = toNumber(actual);
      const e = toNumber(expected);
      return a !== null && e !== null && a > e;
    }
    case "gte": {
      const a = toNumber(actual);
      const e = toNumber(expected);
      return a !== null && e !== null && a >= e;
    }
    case "lt": {
      const a = toNumber(actual);
      const e = toNumber(expected);
      return a !== null && e !== null && a < e;
    }
    case "lte": {
      const a = toNumber(actual);
      const e = toNumber(expected);
      return a !== null && e !== null && a <= e;
    }
    case "isNull":
      return actual == null || actual === "";
    case "isNotNull":
      return actual != null && actual !== "";
    case "in":
      return asArray(expected).map(String).includes(String(actual ?? ""));
    case "notIn":
      return !asArray(expected).map(String).includes(String(actual ?? ""));
    default:
      return false;
  }
}

function isGroup(c: ConditionLeaf | ConditionGroup): c is ConditionGroup {
  return (c as ConditionGroup).kind === "and" || (c as ConditionGroup).kind === "or";
}

export function evaluateCondition(
  cond: ConditionGroup | null | undefined,
  record: Record<string, unknown>,
): boolean {
  if (!cond || !cond.conditions || cond.conditions.length === 0) return true;
  if (cond.kind === "or") {
    return cond.conditions.some((c) =>
      isGroup(c) ? evaluateCondition(c, record) : evalLeaf(c, record),
    );
  }
  // default to AND
  return cond.conditions.every((c) =>
    isGroup(c) ? evaluateCondition(c, record) : evalLeaf(c, record),
  );
}
