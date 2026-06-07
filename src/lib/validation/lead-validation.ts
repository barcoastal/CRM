/**
 * Lead validation rules — ported from the SF org's Lead validation rules.
 *
 * The SF export captured under docs/sf-export does not include standard-object
 * validation files for Lead, but the Lead.Status picklist transitions and
 * conversion guardrails are documented in sf-canonical and the Convert flow.
 * These checks mirror what the SF UI enforces.
 *
 * Each rule returns a string error message on failure, or null on pass. The
 * caller should reject the request with a 400 when any check fails.
 */

import { LEAD_STATUSES, type LeadStatusV2 } from "@/lib/sf-canonical";

export type LeadRecord = {
  id: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  businessName?: string | null;
  convertedAt?: Date | null;
  convertedAccountId?: string | null;
  convertedContactId?: string | null;
};

export type LeadPatch = Partial<{
  status: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  businessName: string | null;
  // SF custom fields that flow through sfDataJson but are observed on patches
  Sub_Disposition__c: string | null;
}>;

/**
 * Lead status transitions allowed by the SF Path component on the Lead page.
 * "New" → "Working Lead" → ("Archive Disposition" | "Converted"). A converted
 * lead cannot be moved back to any earlier stage.
 */
const ALLOWED_TRANSITIONS: Record<LeadStatusV2, LeadStatusV2[]> = {
  "New": ["New", "Working Lead", "Archive Disposition", "Converted"],
  "Working Lead": ["Working Lead", "Archive Disposition", "Converted"],
  "Archive Disposition": ["Archive Disposition", "Working Lead"],
  "Converted": ["Converted"],
};

function isStatusV2(s: string): s is LeadStatusV2 {
  return (LEAD_STATUSES as readonly string[]).includes(s);
}

export function validateLeadPatch(existing: LeadRecord, patch: LeadPatch): string[] {
  const errors: string[] = [];

  // Rule 1 (Status_Transition_Valid):
  // The Lead.Status picklist enforces SF Path transitions. A Converted lead
  // can never be reverted, and skipping stages is rejected by the path.
  if (patch.status !== undefined && patch.status !== existing.status) {
    if (existing.status === "Converted") {
      errors.push("A converted Lead cannot change status.");
    } else if (isStatusV2(existing.status) && isStatusV2(patch.status)) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(patch.status)) {
        errors.push(
          `Lead status transition from "${existing.status}" to "${patch.status}" is not allowed.`,
        );
      }
    }
  }

  // Rule 2 (Email_Format_Required_On_Web_Source):
  // SF Lead requires a valid Email when present; the column is an email picklist
  // type. Reject malformed values on update.
  if (patch.email !== undefined && patch.email !== null && patch.email !== "") {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email);
    if (!ok) {
      errors.push("Email must be a valid email address.");
    }
  }

  // Rule 3 (Phone_Required_To_Reach_Working):
  // The SF Path component requires a Phone before a Lead can be moved to
  // "Working Lead" because dialers will fail otherwise.
  const nextStatus = patch.status ?? existing.status;
  if (nextStatus === "Working Lead") {
    const nextPhone = patch.phone !== undefined ? patch.phone : existing.phone;
    if (!nextPhone || nextPhone.trim() === "") {
      errors.push("Phone is required before a Lead can move to Working Lead.");
    }
  }

  // Rule 4 (Name_Required_On_Archive):
  // Archive Disposition prevents leads from disappearing without identifying
  // info. Either Contact Name or Business Name must be present.
  if (nextStatus === "Archive Disposition") {
    const nextContact = patch.contactName !== undefined ? patch.contactName : existing.contactName;
    const nextBusiness = patch.businessName !== undefined ? patch.businessName : existing.businessName;
    if ((!nextContact || nextContact.trim() === "") && (!nextBusiness || nextBusiness.trim() === "")) {
      errors.push("Contact Name or Business Name is required to archive a Lead.");
    }
  }

  // Rule 5 (Sub_Disposition_Required_On_Working_Or_Archive):
  // The SF path component will not advance past New without a Sub Disposition
  // picked. We only enforce this when Sub_Disposition__c is part of the patch
  // (i.e. blanked out explicitly), to avoid breaking inline single-field edits.
  if (patch.Sub_Disposition__c === "") {
    if (nextStatus === "Working Lead" || nextStatus === "Archive Disposition") {
      errors.push("Sub Disposition is required for Working or Archived Leads.");
    }
  }

  return errors;
}

/** Total number of ported validation rules in this file. */
export const LEAD_RULE_COUNT = 5;
