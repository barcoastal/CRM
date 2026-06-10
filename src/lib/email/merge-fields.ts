/**
 * Catalog of merge fields available inside an email template body. Used by
 * the rich-editor merge-field picker to render a grouped, searchable menu.
 *
 * Inserting a field at the cursor drops the literal token (e.g.
 * "{{lead.firstName}}") into the editor. The send pipeline already supports
 * dotted token paths via mergeTokens() in src/lib/email-sender.ts and the
 * mass sender's instrumentBody().
 */

export interface MergeField {
  key: string;
  label: string;
}

export interface MergeFieldWithContext extends MergeField {
  context: string;
}

export const MERGE_FIELDS_BY_CONTEXT: Record<string, MergeField[]> = {
  lead: [
    { key: "lead.firstName", label: "Lead First Name" },
    { key: "lead.lastName", label: "Lead Last Name" },
    { key: "lead.email", label: "Lead Email" },
    { key: "lead.phone", label: "Lead Phone" },
    { key: "lead.businessName", label: "Business Name" },
    { key: "lead.leadName", label: "Lead Name" },
  ],
  opportunity: [
    { key: "opportunity.name", label: "Opportunity Name" },
    { key: "opportunity.amount", label: "Amount" },
    { key: "opportunity.stage", label: "Stage" },
    { key: "opportunity.totalDebt", label: "Total Debt" },
    { key: "opportunity.monthlyPayment", label: "Monthly Payment" },
  ],
  account: [
    { key: "account.name", label: "Account Name" },
    { key: "account.firstName", label: "Account First Name" },
    { key: "account.lastName", label: "Account Last Name" },
    { key: "account.email", label: "Account Email" },
    { key: "account.phone", label: "Account Phone" },
  ],
  user: [
    { key: "user.name", label: "Sender Name" },
    { key: "user.email", label: "Sender Email" },
  ],
  system: [
    { key: "today", label: "Today's Date" },
    { key: "signingUrl", label: "Signing URL (envelopes only)" },
  ],
};

export const MERGE_CONTEXT_LABELS: Record<string, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  account: "Account",
  user: "User",
  system: "System",
};

/** All merge fields across the requested contexts in display order. */
export function flattenMergeFields(contexts: string[]): MergeFieldWithContext[] {
  const out: MergeFieldWithContext[] = [];
  for (const ctx of contexts) {
    const fields = MERGE_FIELDS_BY_CONTEXT[ctx];
    if (!fields) continue;
    for (const f of fields) out.push({ ...f, context: ctx });
  }
  return out;
}

/** Default context set used by both the standalone template editor and the
 *  in-record composer. Order drives the picker's group order. */
export const DEFAULT_MERGE_CONTEXTS = ["lead", "opportunity", "account", "user", "system"];
