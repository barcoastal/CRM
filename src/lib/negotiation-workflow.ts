export const NEGOTIATION_STAGES = ["Not Started", "Contacting Creditor", "Negotiating", "Offer Submitted", "Agreement Pending", "Settled"] as const;
export type NegotiationStage = (typeof NEGOTIATION_STAGES)[number];
export const STAGE_GUIDANCE: Record<NegotiationStage, string> = {
  "Not Started": "Review the debt balance and creditor details before reaching out.",
  "Contacting Creditor": "Contact the creditor and confirm who handles settlement discussions.",
  "Negotiating": "Record conversations and compare offers and counteroffers.",
  "Offer Submitted": "Record the submitted offer and follow up for the creditor’s response.",
  "Agreement Pending": "Collect the settlement agreement and required signatures.",
  "Settled": "Negotiation is complete. Track the settlement agreement and payments in the settlement records.",
};
export function negotiationStage(value: string | null | undefined, debtStatus?: string): NegotiationStage | null {
  if (NEGOTIATION_STAGES.includes(value as NegotiationStage)) return value as NegotiationStage;
  if (value?.startsWith("Settled ")) return "Settled";
  if (["Waiting for the Settlement Agreement", "Sent to CSR for Client Signature", "Counter Signature from Lender"].includes(value ?? "")) return "Agreement Pending";
  if (value === "Need Correspondence") return "Contacting Creditor";
  if (value === "Declined Offer") return "Negotiating";
  if (value) return null;
  if (debtStatus === "SETTLED" || debtStatus === "PAID") return "Settled";
  if (debtStatus === "NEGOTIATING") return "Negotiating";
  return "Not Started";
}
