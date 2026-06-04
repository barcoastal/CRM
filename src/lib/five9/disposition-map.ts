/**
 * Five9 → CRM disposition map. ONLY entries here trigger the CRM
 * disposition pipeline (LeadHistory + auto-archive + DNC sync); every other
 * Five9 disposition is stored raw on Call.five9DispositionName and left
 * Five9-side only.
 *
 * Source: /api/dialer/five9/disposition-map run on 2026-06-04 — only the
 * 30 ≥85% confidence matches. Suffix variants (_A, _WL, _N, _C) and Five9
 * system events (Spam, Hangup, Voicemail, etc.) are intentionally excluded
 * per Bar's decision.
 */

export const FIVE9_TO_CRM_DISPOSITION: Record<string, string> = {
  // Exact / near-exact matches
  "No Answer": "No Answer",
  "CALLBACK": "Callback",
  "WRONG NUMBER": "Wrong Number",
  "BAD STATE": "Bad State",
  "ENROLL WITH ANOTHER COMPANY": "Enrolled with another company",
  "LOOKING FOR A LOAN": "Looking for a loan",
  "NOT ENOUGH DEBT": "Not Enough Debt",
  "NOT INTERESTED QUALIFIED": "Not Interested Qualified",
  "DO NOT CALL - DNC": "DNC (Do not call)",
  "NO_ANSWER": "No Answer",
  "WELCOME CALL COMPLETED": "Welcome Call Completed",
  "DUPLICATE": "Duplicate",
  "DIDNT REGISTER": "DIDNT Register",
  "NO MCA DEBT": "No MCA Debt",

  // High-confidence suffix variants we elected to surface
  "Stage Change_C": "Stage Change",
  "Wrong Number_N": "Wrong Number",
  "Stage Change_N": "Stage Change",
  "Call Transferred from Fronter_WL": "Call Transferred from Fronter",
  "Cant Save Weekly_A": "Can't Save Weekly",
  "Debt Too New_A": "Debt too new",
  "Enrolled with another company_A": "Enrolled with another company",
  "Looking for Loan_A": "Looking for a loan",
  "Lowered Payments with Lenders_A": "Lowered Payments with Lenders",
  "Not Interested- High UCC risk_A": "Not Interested - High UCC Risk",
  "Not Interested-Qualified_A": "Not Interested Qualified",
  "Number not in Use_A": "Number not in use",
  "Payments are Sustainable_A": "Payments are sustainable",
  "Wrong Number_A": "Wrong Number",
  "Never Answered_A": "Never Answered",
  "Not Interested_A": "Not Interested",
};

/**
 * Look up a Five9 disposition name and return the CRM equivalent.
 * Case-insensitive. Returns null if no mapping exists.
 */
export function mapFive9Disposition(five9Name: string | null | undefined): string | null {
  if (!five9Name) return null;
  if (FIVE9_TO_CRM_DISPOSITION[five9Name]) return FIVE9_TO_CRM_DISPOSITION[five9Name];
  const lower = five9Name.toLowerCase();
  for (const [k, v] of Object.entries(FIVE9_TO_CRM_DISPOSITION)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
