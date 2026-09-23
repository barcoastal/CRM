import type { Case } from "@/generated/prisma/client";
import { snapshot } from "./lead-routing";

export const CASE_APPROVAL_PROCESS_ID = "ccaseapproval00000000000000";
export const CASE_APPROVAL_TYPES = [
  "Skip Payment", "Payment Schedule Modification", "Payment Schedule", "Payment Redraft",
  "Payment Modification/Redraft", "Double Payment Request", "Wire Confirmation",
  "Wire Confirmation and Skip a Payment", "Discontinued Citadel fee", "Add Debits to Schedule",
  "Program Extension", "Refund", "Cancellation",
] as const;

export function caseApprovalEligible(row: Partial<Case>): boolean {
  const sf = snapshot(row.sfDataJson);
  const type = row.type || sf.Type || (row.recordType === "SKIP_PAYMENT" ? "Skip Payment" : row.recordType === "CANCELLATION" ? "Cancellation" : null);
  // SUPPORT is the CRM equivalent of Customer Support; the legacy subtype
  // records SKIP_PAYMENT/CANCELLATION also belong to customer support.
  return ["SUPPORT", "Customer Support", "Customer_Support", "SKIP_PAYMENT", "CANCELLATION"].includes(row.recordType ?? "SUPPORT") &&
    CASE_APPROVAL_TYPES.includes(type as typeof CASE_APPROVAL_TYPES[number]);
}
