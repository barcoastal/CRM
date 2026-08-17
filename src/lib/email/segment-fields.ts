/**
 * Server-side whitelist of segment-filterable fields per entity. Prevents
 * probing sensitive columns (ssn, ein, birthdate, bank fields) through the
 * segment count oracle or stored segment filters.
 */
import type { ListFilter } from "@/lib/list-views";

export const SEGMENT_FIELDS: Record<string, ReadonlySet<string>> = {
  Lead: new Set([
    "status", "source", "recordType", "state", "assignedToId",
    "totalDebtEst", "createdAt", "updatedAt",
  ]),
  Contact: new Set([
    "isActive", "ownerId", "mailingState", "createdAt", "updatedAt",
  ]),
};

/** Returns an error message when any filter references a non-whitelisted field, else null. */
export function validateSegmentFilters(filters: ListFilter[], entity: string): string | null {
  const allowed = SEGMENT_FIELDS[entity] ?? SEGMENT_FIELDS.Lead;
  for (const f of filters) {
    if (f.op === "OR" && Array.isArray(f.value)) {
      const nested = validateSegmentFilters(f.value as ListFilter[], entity);
      if (nested) return nested;
      continue;
    }
    if (!allowed.has(f.field)) return `Field "${f.field}" is not filterable`;
  }
  return null;
}
