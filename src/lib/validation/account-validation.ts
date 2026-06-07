/**
 * Account validation rules — ported from the SF org's Account object.
 *
 * The SF export under docs/sf-export does not include standard-object
 * validation files for Account, but the Account_Status_Mapping__mdt metadata
 * + the Account.Stage picklist documents the transitions the SF UI enforces.
 */

import { ACCOUNT_STAGES, type AccountStage } from "@/lib/sf-canonical";

export type AccountRecord = {
  id: string;
  stage: string;
  name?: string | null;
  email?: string | null;
  recordType?: string;
  parentAccountId?: string | null;
};

export type AccountPatch = Partial<{
  stage: string;
  name: string | null;
  email: string | null;
  parentAccountId: string | null;
}>;

function isStage(s: string): s is AccountStage {
  return (ACCOUNT_STAGES as readonly string[]).includes(s);
}

const TERMINAL_STAGES: AccountStage[] = [
  "Cancelled",
  "Graduated",
  "Closed Duplicate",
];

export function validateAccountPatch(existing: AccountRecord, patch: AccountPatch): string[] {
  const errors: string[] = [];

  // Rule 1 (Stage_Terminal_Lock):
  // Cancelled, Graduated, and Closed Duplicate accounts cannot move to an
  // earlier stage. SF locks the picklist when the account is terminal.
  if (patch.stage !== undefined && patch.stage !== existing.stage) {
    if (isStage(existing.stage) && TERMINAL_STAGES.includes(existing.stage)) {
      errors.push(`Account stage "${existing.stage}" is terminal and cannot be changed.`);
    }
  }

  // Rule 2 (Name_Required): Account.Name is required. Blanking it out fails.
  if (patch.name !== undefined && (!patch.name || patch.name.trim() === "")) {
    errors.push("Account Name is required.");
  }

  // Rule 3 (Email_Format): if email is set, it must look like an email.
  if (patch.email !== undefined && patch.email !== null && patch.email !== "") {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email);
    if (!ok) errors.push("Email must be a valid email address.");
  }

  // Rule 4 (No_Self_Parent): an account cannot be its own parent.
  if (patch.parentAccountId !== undefined && patch.parentAccountId === existing.id) {
    errors.push("An Account cannot be its own parent.");
  }

  return errors;
}

export const ACCOUNT_RULE_COUNT = 4;
