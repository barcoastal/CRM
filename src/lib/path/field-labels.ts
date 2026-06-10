/**
 * Field-label registry for the Path Guidance "Key Fields" panel.
 *
 * Maps an entity to a list of dotted field paths (resolved against the record
 * row returned to the detail page) plus the human label shown in the
 * checklist. Used both by the runtime side panel and the Settings UI to
 * populate the multi-select editor.
 *
 * Keep this list intentionally short. SF only surfaces 3-5 key fields per
 * stage so the rep can scan it in under a second.
 */

export interface FieldOption {
  /** Dotted path to resolve on the record (e.g. "owner.name"). */
  path: string;
  /** Label shown in the side panel + editor. */
  label: string;
  /** Display hint so the resolver can format the raw value nicely. */
  format?: "text" | "money" | "date" | "phone" | "email";
}

export type EntityKey = "Lead" | "Opportunity" | "Account" | "Case";

export const ENTITY_FIELD_OPTIONS: Record<EntityKey, FieldOption[]> = {
  Lead: [
    { path: "contactName", label: "Contact Name" },
    { path: "businessName", label: "Business Name" },
    { path: "phone", label: "Phone", format: "phone" },
    { path: "email", label: "Email", format: "email" },
    { path: "leadName", label: "Lead Name" },
    { path: "industry", label: "Industry" },
    { path: "source", label: "Lead Source" },
    { path: "totalDebtEst", label: "Estimated Total Debt", format: "money" },
    { path: "annualRevenue", label: "Annual Revenue", format: "money" },
    { path: "ein", label: "EIN" },
    { path: "status", label: "Status" },
    { path: "score", label: "Lead Score" },
    { path: "notes", label: "Notes" },
    { path: "assignedTo.name", label: "Owner" },
  ],
  Opportunity: [
    { path: "name", label: "Opportunity Name" },
    { path: "stage", label: "Stage" },
    { path: "amount", label: "Amount", format: "money" },
    { path: "totalDebt", label: "Total Debt", format: "money" },
    { path: "monthlyPayment", label: "Monthly Payment", format: "money" },
    { path: "closeDate", label: "Close Date", format: "date" },
    { path: "probability", label: "Probability" },
    { path: "forecastCategory", label: "Forecast Category" },
    { path: "assignedTo.name", label: "Owner" },
    { path: "account.name", label: "Account" },
    { path: "primaryContact.fullName", label: "Primary Contact" },
    { path: "lead.contactName", label: "Originating Lead" },
    { path: "nextStep", label: "Next Step" },
  ],
  Account: [
    { path: "name", label: "Account Name" },
    { path: "stage", label: "Stage" },
    { path: "primaryContactId", label: "Primary Contact" },
    { path: "owner.name", label: "Account Owner" },
    { path: "phone", label: "Phone", format: "phone" },
    { path: "email", label: "Email", format: "email" },
    { path: "billingAddress", label: "Billing Address" },
    { path: "bankAccountStatus", label: "Bank Account Status" },
    { path: "totalDebt", label: "Total Debt", format: "money" },
    { path: "monthlyPayment", label: "Monthly Payment", format: "money" },
    { path: "industry", label: "Industry" },
    { path: "annualRevenue", label: "Annual Revenue", format: "money" },
  ],
  Case: [
    { path: "subject", label: "Subject" },
    { path: "status", label: "Status" },
    { path: "priority", label: "Priority" },
    { path: "recordType", label: "Type" },
    { path: "origin", label: "Origin" },
    { path: "owner.name", label: "Owner" },
    { path: "account.name", label: "Account" },
    { path: "contact.fullName", label: "Contact" },
    { path: "escalationLevel", label: "Escalation Level" },
    { path: "slaDueAt", label: "SLA Due", format: "date" },
    { path: "firstResponseAt", label: "First Response", format: "date" },
    { path: "description", label: "Description" },
  ],
};

/** All entity keys, useful for the Settings dropdown. */
export const ENTITY_KEYS: EntityKey[] = ["Lead", "Opportunity", "Account", "Case"];

/**
 * Look up the registered option for a field path, falling back to a
 * humanized version of the path itself when not found (so unknown paths
 * still render, just less prettily).
 */
export function getFieldOption(entity: EntityKey, path: string): FieldOption {
  const found = ENTITY_FIELD_OPTIONS[entity]?.find((f) => f.path === path);
  if (found) return found;
  return {
    path,
    label: path
      .split(".")
      .map((seg) => seg.replace(/([A-Z])/g, " $1"))
      .join(" › ")
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim(),
  };
}

/** Format a resolved value according to the option's hint. */
export function formatFieldValue(value: unknown, format?: FieldOption["format"]): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (format === "money" && typeof value === "number") {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (format === "date") {
    const d = value instanceof Date ? value : new Date(String(value));
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
