/**
 * SF parity: LeadTriggerHandler.calculateCurrentTotalWeeklyPayment
 *
 * SF stores up to 10 creditor payment + frequency fields directly on the Lead
 * row. We model creditors as LeadDebt rows instead. Whenever a LeadDebt row
 * is inserted/updated/deleted we recompute the weekly total and stamp it on
 * Lead.currentTotalWeeklyPayment so reports + the Lead detail page stay in
 * sync with the legacy SF formula.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function normalizeToWeekly(amount: number, frequency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (frequency) {
    case "DAILY":
      return amount * 5; // SF business-week multiplier (mirrors LeadTriggerHandler)
    case "WEEKLY":
      return amount;
    case "BI_WEEKLY":
      return amount / 2;
    case "MONTHLY":
      return amount / 4;
    case "LUMP_SUM":
      return 0; // one-time, not a recurring payment
    default:
      return amount;
  }
}

export async function recalcLeadWeeklyPayment(
  leadId: string,
  db: Pick<Prisma.TransactionClient, "leadDebt" | "lead"> = prisma,
): Promise<number> {
  const debts = await db.leadDebt.findMany({
    where: { leadId, status: "ACTIVE" },
    select: { paymentAmount: true, frequency: true },
  });
  let total = 0;
  for (const d of debts) {
    if (d.paymentAmount == null) continue;
    total += normalizeToWeekly(d.paymentAmount, d.frequency);
  }
  total = Math.round(total * 100) / 100;
  await db.lead.update({
    where: { id: leadId },
    data: { currentTotalWeeklyPayment: total },
  });
  return total;
}
