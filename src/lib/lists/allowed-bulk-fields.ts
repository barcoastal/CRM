/**
 * Per-entity allowlist for bulk-edit API.
 *
 * Bulk patches are rejected if they touch any field that isn't on the
 * allowlist for that entity. We narrowly enumerate to keep the bulk API
 * from becoming an arbitrary write surface.
 *
 * Each entry is the prisma column name (camelCase as in the schema).
 */

export type BulkEntity =
  | "lead"
  | "opportunity"
  | "account"
  | "contact"
  | "case"
  | "task"
  | "event"
  | "client"
  | "creditor"
  | "offer"
  | "settlement"
  | "fee"
  | "draft"
  | "programPlan";

/**
 * Allowed bulk-edit fields per entity. Keep these narrow.
 *
 * Notes:
 *  - Lead uses `assignedToId` (not ownerId) and stores last disposition in
 *    `lastDisposition`. We expose status/source/recordType/assignedToId.
 *  - Opportunity uses `assignedToId`. We expose stage/recordType/subDisposition
 *    plus the assignedToId for owner reassignment.
 *  - Account has `clientStatus`, `stage`, `recordType`. We expose ownerId,
 *    clientStatus, stage, recordType.
 *  - Task / Event / Case use `ownerId`.
 */
export const ALLOWED_BULK_FIELDS: Record<BulkEntity, readonly string[]> = {
  lead: ["assignedToId", "status", "lastDisposition", "source", "recordType"],
  opportunity: ["assignedToId", "stage", "subDisposition", "recordType"],
  account: ["ownerId", "clientStatus", "stage", "recordType"],
  contact: ["ownerId"],
  case: ["ownerId", "status", "priority"],
  task: ["ownerId", "status", "priority", "dueDate", "type"],
  event: ["ownerId", "status"],
  client: ["assignedNegotiatorId", "status"],
  creditor: [],
  offer: ["status"],
  settlement: ["recordType"],
  fee: ["recordType"],
  draft: ["status"],
  programPlan: ["assignedToId", "status"],
} as const;

/**
 * Prisma model name keyed by the entity slug used in the bulk-edit URL.
 * (`prisma[modelName]` shape.)
 */
export const PRISMA_MODEL_FOR: Record<BulkEntity, string> = {
  lead: "lead",
  opportunity: "opportunity",
  account: "account",
  contact: "contact",
  case: "case",
  task: "task",
  event: "event",
  client: "client",
  creditor: "creditor",
  offer: "offer",
  settlement: "settlement",
  fee: "fee",
  draft: "draft",
  programPlan: "programPlan",
};

/**
 * Human-friendly singular label per entity. Used in audit/log messages.
 */
export const ENTITY_LABEL: Record<BulkEntity, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  account: "Account",
  contact: "Contact",
  case: "Case",
  task: "Task",
  event: "Event",
  client: "Client",
  creditor: "Creditor",
  offer: "Offer",
  settlement: "Settlement",
  fee: "Fee",
  draft: "Draft",
  programPlan: "ProgramPlan",
};

export function isBulkEntity(v: string): v is BulkEntity {
  return Object.prototype.hasOwnProperty.call(ALLOWED_BULK_FIELDS, v);
}

/**
 * Filter a patch object down to the allowed fields. Returns a new object
 * containing only allowlisted keys with their values coerced if needed.
 * Fields that arrive as the literal string "" are converted to null so the
 * UI can clear a value by submitting an empty input.
 */
export function pickAllowedPatch(
  entity: BulkEntity,
  patch: Record<string, unknown>,
): { data: Record<string, unknown>; rejected: string[] } {
  const allowed = new Set(ALLOWED_BULK_FIELDS[entity]);
  const data: Record<string, unknown> = {};
  const rejected: string[] = [];
  for (const [k, vRaw] of Object.entries(patch ?? {})) {
    if (!allowed.has(k)) {
      rejected.push(k);
      continue;
    }
    let v: unknown = vRaw;
    // empty string -> null so clearing works via inline edit
    if (v === "") v = null;
    // ISO string dates -> Date for date columns
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && DATE_FIELDS.has(`${entity}.${k}`)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) v = d;
    }
    data[k] = v;
  }
  return { data, rejected };
}

/**
 * Per-entity fields that are stored as DateTime in the schema. Used to
 * coerce ISO strings to Date objects before handing to prisma.
 */
const DATE_FIELDS = new Set<string>([
  "task.dueDate",
  "opportunity.closeDate",
  "event.startAt",
  "event.endAt",
]);
