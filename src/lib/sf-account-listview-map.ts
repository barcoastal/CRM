/**
 * Pure mapping from extracted Salesforce Account list-view definitions
 * (docs/sf-export/account-listviews.json) to the CRM ListView shape.
 *
 * No DB access here — owner filters are returned as { ownerNames } for the
 * seed script to resolve to ownerIds at runtime. Kept pure so the mapping can
 * be unit-tested / dry-run without a database.
 */

export type RawFilter = { raw: string; _note?: string };
export type RawList = {
  label: string;
  developerName: string;
  scope: string | null;
  filters: RawFilter[];
  columns: string[];
  _note?: string;
};

export type ListFilter = { field: string; op: string; value?: unknown };

type FieldDef =
  | { key: string; kind: "string" | "number" | "boolean" | "date"; valueMap?: Record<string, string> }
  | { kind: "owner" }
  | { kind: "unmappable"; reason: string };

export const FIELD_MAP: Record<string, FieldDef> = {
  "Owner Full Name": { kind: "owner" },
  "Client Status": { key: "stage", kind: "string" }, // CRM Account.stage holds the SF Client Status picklist
  "Payment Status": { key: "paymentStatus", kind: "string" },
  "Processor Status": { key: "processorStatus", kind: "string" },
  "Legal Status": { key: "legalStatus", kind: "string" },
  "Account Record Type": {
    key: "recordType",
    kind: "string",
    valueMap: { Creditor: "CREDITOR", Vendor: "VENDOR", Client: "CLIENT" },
  },
  "External SAS Id": { key: "externalSasId", kind: "string" },
  "External RAM Id": { key: "externalRamId", kind: "string" },
  "HIGH UCC RISK": { key: "highUccRisk", kind: "boolean" },
  "Program Completion Stage": { key: "programCompletionStage", kind: "boolean" },
  "Net Profit": { key: "netProfit", kind: "number" },
  "Fee Paid In Full": { key: "feePaidInFull", kind: "boolean" },
  "Total Debt": { key: "currentTotalDebt", kind: "number" },
  "Industry": { key: "industry", kind: "string" },
  "Program Start Date": { key: "programStartDate", kind: "date" },
  "Program End Date": { key: "programEndDate", kind: "date" },
  "Last Modified Date": { key: "updatedAt", kind: "date" },
  // No Account equivalent — skipped, reported:
  "External Creditor Id": { kind: "unmappable", reason: "no external creditor id field on Account" },
  "Qualified Financial": { kind: "unmappable", reason: "no boolean 'qualified financial' field (qualifiedStatus is a string)" },
  "Debt Negotiator": { kind: "unmappable", reason: "negotiator lives on Client, not Account" },
};

export const COLUMN_MAP: Record<string, string | null> = {
  "Account Name": "name",
  "Owner Full Name": "owner.name",
  "Account Owner Alias": "owner.name",
  "Primary Contact": "primaryContact.name",
  "Primary Contact Name": "primaryContact.name",
  "Client Status": "stage",
  "Payment Status": "paymentStatus",
  "Processor Status": "processorStatus",
  "Legal Status": "legalStatus",
  "Phone": "phone",
  "Billing State/Province": "billingState",
  "Total Debt": "currentTotalDebt",
  "Industry": "industry",
  "Type": "type",
  "First Contract Signed Date": "firstContractSignedDate",
  "Program Start Date": "programStartDate",
  "Program End Date": "programEndDate",
  "Last Modified Date": "updatedAt",
  "Fee Paid In Full": "feePaidInFull",
  "External SAS Id": "externalSasId",
  "External RAM Id": "externalRamId",
  "Account Site": null,
  "Sub Disposition": null,
  "Last Contacted DateTime": null,
  "Lead Id": null,
  "Debt Negotiator": null,
  "Creditor Type": null,
  "First Payment Completed Date": null,
  "Net Profit": null,
};

const OP_PHRASES = ["not equal to", "greater than", "less than", "equals", "contains"];

/** A filter that still needs owner-name -> ownerId resolution by the seed script. */
export type OwnerFilter = { ownerNames: string[] };

export function parseRaw(raw: string): { fieldLabel: string; op: string; value: string } | null {
  const fieldLabel = Object.keys(FIELD_MAP)
    .filter((f) => raw.startsWith(f))
    .sort((a, b) => b.length - a.length)[0];
  if (!fieldLabel) return null;
  const rest = raw.slice(fieldLabel.length).trim();
  const op = OP_PHRASES.find((p) => rest.startsWith(p));
  if (!op) return null;
  return { fieldLabel, op, value: rest.slice(op.length).trim() };
}

/**
 * Map one raw filter. Returns:
 *  - a ListFilter (scalar), or
 *  - an OwnerFilter (needs ownerId resolution), or
 *  - null (dropped — reason pushed to `warnings`).
 */
export function mapFilter(rf: RawFilter, listLabel: string, warnings: string[]): ListFilter | OwnerFilter | null {
  const parsed = parseRaw(rf.raw);
  if (!parsed) {
    warnings.push(`[${listLabel}] could not parse filter: "${rf.raw}"`);
    return null;
  }
  const def = FIELD_MAP[parsed.fieldLabel];
  if ("kind" in def && def.kind === "unmappable") {
    warnings.push(`[${listLabel}] dropped unmappable filter "${parsed.fieldLabel}" (${def.reason})`);
    return null;
  }

  const { op, value } = parsed;
  const blank = value === "" || value === ",";

  if ("kind" in def && def.kind === "owner") {
    if (blank) {
      warnings.push(`[${listLabel}] owner filter had blank value — skipped`);
      return null;
    }
    const ownerNames = value.split(",").map((s) => s.trim()).filter(Boolean);
    return { ownerNames };
  }

  const fd = def as { key: string; kind: string; valueMap?: Record<string, string> };
  const mapVal = (v: string) => (fd.valueMap && fd.valueMap[v.trim()]) || v.trim();
  const coerce = (v: string): unknown => {
    if (fd.kind === "boolean") return /^true$/i.test(v.trim());
    if (fd.kind === "number") return Number(v.trim());
    return mapVal(v);
  };
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);

  switch (op) {
    case "equals":
      if (blank) return { field: fd.key, op: "IS_NULL" };
      return parts.length > 1
        ? { field: fd.key, op: "IN", value: parts.map(mapVal) }
        : { field: fd.key, op: "EQ", value: coerce(value) };
    case "not equal to":
      if (blank) return { field: fd.key, op: "IS_NOT_NULL" };
      return parts.length > 1
        ? { field: fd.key, op: "NOT_IN", value: parts.map(mapVal) }
        : { field: fd.key, op: "NEQ", value: coerce(value) };
    case "contains":
      if (blank) return null;
      return { field: fd.key, op: "CONTAINS", value };
    case "greater than":
      if (blank) {
        warnings.push(`[${listLabel}] "${parsed.fieldLabel} greater than" had blank value — skipped`);
        return null;
      }
      return { field: fd.key, op: "GT", value: coerce(value) };
    case "less than":
      return { field: fd.key, op: "LT", value: coerce(value) };
    default:
      return null;
  }
}

export function isOwnerFilter(f: ListFilter | OwnerFilter): f is OwnerFilter {
  return (f as OwnerFilter).ownerNames !== undefined;
}

export function mapColumns(cols: string[], listLabel: string, warnings: string[]): string[] {
  const out: string[] = [];
  for (const c of cols) {
    if (!(c in COLUMN_MAP)) {
      warnings.push(`[${listLabel}] unknown column "${c}" — dropped`);
      continue;
    }
    const k = COLUMN_MAP[c];
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
