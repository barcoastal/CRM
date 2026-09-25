import { z } from "zod";

export const debtRowSchema = z.object({
  key: z.string().min(1).max(100),
  id: z.string().min(1).max(100).optional(),
  creditorName: z.string().trim().min(1).max(200),
  amount: z.number().min(0.01).max(1_000_000_000),
});
export const qualificationSchema = z
  .object({
    id: z.string().min(1).max(100),
    debts: z.array(debtRowSchema).min(1).max(100),
    removedDebtIds: z.array(z.string().min(1).max(100)).max(100).default([]),
    notes: z.string().trim().min(1).max(10000),
  })
  .superRefine((input, ctx) => {
    if (new Set(input.debts.map((row) => row.key)).size !== input.debts.length)
      ctx.addIssue({ code: "custom", message: "Duplicate lender rows" });
    const ids = input.debts.flatMap((row) => (row.id ? [row.id] : []));
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => input.removedDebtIds.includes(id))
    )
      ctx.addIssue({ code: "custom", message: "Conflicting lender rows" });
    if (debtTotal(input.debts) > 1_000_000_000)
      ctx.addIssue({ code: "custom", message: "Debt total is too large" });
  });
export type QualifiedDebt = z.infer<typeof debtRowSchema>;
export const debtTotal = (rows: { amount: number }[]) =>
  rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
export function readQualifiedDebts(value: unknown): QualifiedDebt[] {
  const parsed = z.array(debtRowSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
export const APPROVAL_STAGES = [
  "PENDING_APPROVAL",
  "PENDING_CLOSER",
  "CLOSER_READY",
  "TRANSFER_PENDING",
  "TRANSFER_CANCELING",
];
export function leadProvenance(lead: {
  source: string;
  brand: string | null;
  sfId: string | null;
  sfDataJson: string | null;
}) {
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = JSON.parse(lead.sfDataJson || "{}");
  } catch {}
  return {
    source:
      lead.sfId &&
      typeof snapshot?.LeadSource === "string" &&
      snapshot.LeadSource.trim()
        ? snapshot.LeadSource
        : lead.source,
    brand:
      lead.brand ||
      (typeof snapshot?.Brand__c === "string" ? snapshot.Brand__c : null),
  };
}
