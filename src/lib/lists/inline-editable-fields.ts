/**
 * Per-entity inline-edit field configs. Read by the inline edit cell to
 * decide how to render the cell as an input. Fields that aren't in this
 * map are NOT inline-editable, even if they're allowlisted for bulk.
 *
 * type semantics:
 *   - "text"    -> single-line input
 *   - "number"  -> numeric input (parsed as Number)
 *   - "date"    -> date input (ISO yyyy-mm-dd)
 *   - "boolean" -> checkbox
 *   - "enum"    -> select with `options`
 *
 * The cell never renders for JSON or long-text fields. Those are skipped
 * by the table (the row click navigates to the record instead).
 */

import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/validations/lead";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";
import {
  ACCOUNT_RECORD_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  EVENT_STATUSES,
  TASK_STATUSES,
} from "@/lib/record-types";

export type InlineFieldType = "text" | "number" | "date" | "boolean" | "enum";

export interface InlineFieldConfig {
  /** db column path (matches the prisma model field name) */
  field: string;
  type: InlineFieldType;
  /** when `type === "enum"`. For owner pickers use type "enum" with `optionsKind: "users"` */
  options?: { value: string; label: string }[];
  /** for enums where the option list comes from a remote fetch (users) */
  optionsKind?: "users";
  /** optional formatter for the read-only display value */
  format?: (v: unknown) => string;
}

const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH"].map((p) => ({ value: p, label: p }));
const CASE_PRIORITY_OPTIONS = CASE_PRIORITIES.map((p) => ({ value: p, label: p }));

export const INLINE_EDITABLE_FIELDS: Record<string, InlineFieldConfig[]> = {
  lead: [
    { field: "contactName", type: "text" },
    { field: "businessName", type: "text" },
    { field: "phone", type: "text" },
    { field: "email", type: "text" },
    { field: "status", type: "enum", options: LEAD_STATUSES.map((s) => ({ value: s, label: s })) },
    { field: "source", type: "enum", options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) },
    { field: "assignedToId", type: "enum", optionsKind: "users" },
  ],
  opportunity: [
    { field: "name", type: "text" },
    { field: "stage", type: "enum", options: OPPORTUNITY_STAGES.map((s) => ({ value: s, label: s })) },
    { field: "amount", type: "number" },
    { field: "closeDate", type: "date" },
    { field: "assignedToId", type: "enum", optionsKind: "users" },
  ],
  account: [
    { field: "name", type: "text" },
    { field: "clientStatus", type: "enum", options: ["Active", "Inactive", "Hardship", "Cancelled"].map((s) => ({ value: s, label: s })) },
    { field: "recordType", type: "enum", options: ACCOUNT_RECORD_TYPES.map((s) => ({ value: s, label: s })) },
    { field: "ownerId", type: "enum", optionsKind: "users" },
  ],
  contact: [
    { field: "ownerId", type: "enum", optionsKind: "users" },
  ],
  task: [
    { field: "subject", type: "text" },
    { field: "status", type: "enum", options: TASK_STATUSES.map((s) => ({ value: s, label: s })) },
    { field: "priority", type: "enum", options: PRIORITY_OPTIONS },
    { field: "dueDate", type: "date" },
    { field: "ownerId", type: "enum", optionsKind: "users" },
  ],
  event: [
    { field: "subject", type: "text" },
    { field: "status", type: "enum", options: EVENT_STATUSES.map((s) => ({ value: s, label: s })) },
    { field: "ownerId", type: "enum", optionsKind: "users" },
  ],
  case: [
    { field: "subject", type: "text" },
    { field: "status", type: "enum", options: CASE_STATUSES.map((s) => ({ value: s, label: s })) },
    { field: "priority", type: "enum", options: CASE_PRIORITY_OPTIONS },
    { field: "ownerId", type: "enum", optionsKind: "users" },
  ],
};

export function getInlineConfig(entity: string, field: string): InlineFieldConfig | null {
  const list = INLINE_EDITABLE_FIELDS[entity];
  if (!list) return null;
  return list.find((c) => c.field === field) ?? null;
}
