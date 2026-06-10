/**
 * Pure (prisma-free) field helpers for the Path Key Fields panel. Kept separate
 * from guidance.ts so client components can import them without pulling the
 * server-only prisma client into the browser bundle.
 */

/**
 * Resolve a dotted field path against a record. Supports nested objects
 * (e.g. "owner.name") and arrays by index (e.g. "debts.0.amount"). Returns
 * `undefined` when any segment is missing.
 */
export function resolveFieldValue(
  record: Record<string, unknown> | null | undefined,
  fieldPath: string,
): unknown {
  if (!record || !fieldPath) return undefined;
  const segments = fieldPath.split(".");
  let cur: unknown = record;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * "Filled" means the field has a meaningful value. Empty strings, null,
 * undefined, and empty arrays count as empty. 0 and false count as filled
 * because they are intentional values for numeric and boolean fields.
 */
export function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Date) return !isNaN(value.getTime());
  return true;
}
