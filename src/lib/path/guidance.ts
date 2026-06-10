import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Server-side helper for SF-style Path Guidance + Key Fields.
 *
 * A PathGuidance row exists per (entityType, stage). It carries:
 *   - keyFields: an ordered list of dotted field paths used as a Key Fields
 *     checklist on the rep's record detail page.
 *   - guidance: a markdown blob shown in the Guidance for Success panel.
 *
 * Both are surfaced next to the SF Path tracker so the rep knows what to do
 * at the current stage and what to fill in before advancing.
 */

export interface GuidanceRow {
  keyFields: string[];
  guidance: string | null;
}

/**
 * Fetch the active guidance row for an entity+stage pair. Cached per request
 * via React `cache()` so multiple components on the same page share a single
 * DB hit.
 */
export const getGuidance = cache(
  async (entityType: string, stage: string): Promise<GuidanceRow | null> => {
    if (!entityType || !stage) return null;
    const row = await prisma.pathGuidance.findUnique({
      where: { entityType_stage: { entityType, stage } },
    });
    if (!row || !row.isActive) return null;
    const keyFields = Array.isArray(row.keyFields)
      ? (row.keyFields as unknown[]).filter((f): f is string => typeof f === "string")
      : [];
    return {
      keyFields,
      guidance: row.guidance ?? null,
    };
  },
);

/**
 * Resolve a dotted field path against a record. Supports nested objects
 * (e.g. "owner.name") and arrays by index (e.g. "debts.0.amount"). Returns
 * `undefined` when any segment is missing.
 *
 * Designed for the Key Fields panel which surfaces a small set of fields
 * the rep should fill before progressing the stage.
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
 * undefined, empty arrays, and zero-amount-looking values count as empty.
 * We accept 0 and false as filled because they are intentional values for
 * numeric and boolean fields.
 */
export function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Date) return !isNaN(value.getTime());
  return true;
}
