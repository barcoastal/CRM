/**
 * Writable CRM targets for SIGNER-entered e-sign fields ("collect to").
 *
 * The inverse of merge-paths (which READ CRM data into the PDF): when a signer
 * fills a tagged field, its value is written back to the linked Account on
 * signing. Only fields that actually exist on the Account are offered.
 *
 * For checkbox fields, the box's `label` is the value written when ticked
 * (e.g. a "Checking" checkbox tagged to bankAccountType writes "Checking").
 */
export interface CollectTarget {
  value: string; // stored on the box as `collectTo`
  label: string; // shown in the editor picker
  entity: "account";
  field: "bankName" | "bankRoutingNumber" | "bankAccountNumber" | "bankAccountType";
}

export const COLLECT_TARGETS: CollectTarget[] = [
  { value: "account.bankName", label: "Account · Bank Name", entity: "account", field: "bankName" },
  { value: "account.bankRoutingNumber", label: "Account · Bank Routing #", entity: "account", field: "bankRoutingNumber" },
  { value: "account.bankAccountNumber", label: "Account · Bank Account #", entity: "account", field: "bankAccountNumber" },
  { value: "account.bankAccountType", label: "Account · Account Type (Checking/Savings)", entity: "account", field: "bankAccountType" },
];

export const COLLECT_TARGET_VALUES = new Set(COLLECT_TARGETS.map((t) => t.value));

export function collectTarget(value: string | undefined | null): CollectTarget | undefined {
  if (!value) return undefined;
  return COLLECT_TARGETS.find((t) => t.value === value);
}
