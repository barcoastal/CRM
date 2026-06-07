/**
 * Opportunity validation rules — ported from the SF org's Opportunity object
 * and the Program_Plan / Debt_Details validation rules captured in
 * docs/sf-export/sfdx-raw/objects.
 *
 * Returns an array of error messages on failure. The PATCH endpoint should
 * reject with 400 when this list is non-empty.
 */

import { OPP_STAGES, type OppStage } from "@/lib/sf-canonical";

export type OppRecord = {
  id: string;
  stage: string;
  accountId?: string | null;
  totalDebt?: number | null;
  paymentTerm?: number | null;
  expectedCloseDate?: Date | null;
};

export type OppPatch = Partial<{
  stage: string;
  accountId: string | null;
  totalDebt: number | null;
  paymentTerm: number | null;
  expectedCloseDate: string | Date | null;
  Payment_Term__c: string | null;
}>;

function isStage(s: string): s is OppStage {
  return (OPP_STAGES as readonly string[]).includes(s);
}

/**
 * Closed Won / Closed Lost / Archived stages are terminal — once a record is
 * there the SF UI does not allow re-opening it.
 */
const TERMINAL_STAGES: OppStage[] = [
  "Closed Won - First Payment Completed",
  "Closed Lost",
  "Archived",
];

export function validateOppPatch(existing: OppRecord, patch: OppPatch): string[] {
  const errors: string[] = [];

  // Rule 1 (Stage_Transition_Valid):
  // Terminal stages (Closed Won Completed, Closed Lost, Archived) cannot move
  // back to Working/Pending stages. SF locks the picklist when stage is final.
  if (patch.stage !== undefined && patch.stage !== existing.stage) {
    if (isStage(existing.stage) && TERMINAL_STAGES.includes(existing.stage)) {
      errors.push(
        `Opportunity stage "${existing.stage}" is terminal and cannot be changed.`,
      );
    }
    if (isStage(patch.stage) && !TERMINAL_STAGES.includes(patch.stage) &&
        isStage(existing.stage) && TERMINAL_STAGES.includes(existing.stage)) {
      errors.push("Cannot re-open a closed Opportunity.");
    }
  }

  // Rule 2 (Account_Reparent_Locked): mirrors the Program Plan
  // Restrict_to_Reparent_the_Account rule — once the opp has an Account it
  // cannot be reparented because the related Program Plan / Debt Details would
  // become orphaned ("Program Plan cannot be reparented to different Account").
  if (
    patch.accountId !== undefined &&
    existing.accountId &&
    patch.accountId !== existing.accountId
  ) {
    errors.push("Opportunity cannot be reparented to a different Account.");
  }

  // Rule 3 (Total_Debt_Positive): SF Total_Debt__c is a currency, must be > 0
  // when set. Zero or negative breaks the Program Length lookup.
  if (patch.totalDebt !== undefined && patch.totalDebt !== null) {
    if (!(patch.totalDebt > 0)) {
      errors.push("Total Debt must be greater than zero.");
    }
  }

  // Rule 4 (Program_Length_Approval_Process):
  // Closer profile attempts to change Payment_Term__c outside the approved
  // band require manager approval. We surface the same error message the SF
  // rule shows. The matrix below comes verbatim from
  // docs/sf-export/sfdx-raw/objects/Program_Plan__c/validationRules/Program_Length_Approval_Process.validationRule-meta.xml
  const nextDebt = patch.totalDebt !== undefined ? patch.totalDebt : existing.totalDebt;
  const rawTerm = patch.Payment_Term__c ?? (patch.paymentTerm != null ? String(patch.paymentTerm) : undefined);
  if (rawTerm != null && nextDebt != null) {
    const term = Number(rawTerm);
    if (Number.isFinite(term) && Number.isFinite(nextDebt)) {
      const requiredTerm = approvedTermForDebt(nextDebt);
      if (requiredTerm != null && term !== requiredTerm) {
        errors.push("Closer profile can't change payment terms. Need to get approval from supervisors.");
      }
    }
  }

  // Rule 5 (Close_Date_Required_When_Closing):
  // Moving an opp to a Closed Won stage requires Expected Close Date populated.
  if (patch.stage === "Closed Won First Payment Pending" || patch.stage === "Closed Won - First Payment Completed") {
    const nextClose = patch.expectedCloseDate !== undefined ? patch.expectedCloseDate : existing.expectedCloseDate;
    if (!nextClose) {
      errors.push("Expected Close Date is required when closing an Opportunity.");
    }
  }

  return errors;
}

/** Implements the Program_Length_Approval_Process matrix. */
function approvedTermForDebt(debt: number): number | null {
  if (debt <= 49999) return 6;
  if (debt <= 74999) return 8;
  if (debt <= 99999) return 10;
  if (debt <= 149999) return 11;
  if (debt <= 199999) return 12;
  if (debt <= 299999) return 14;
  return 16;
}

export const OPP_RULE_COUNT = 5;
