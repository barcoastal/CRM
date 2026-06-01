/**
 * Pure aggregators for PaymentSummary fields. Run against a fetched window
 * (drafts, fees, settlements) and return totals.
 */

export interface DraftLike {
  status: string;
  amount: number;
  settledAt?: Date | null;
}
export interface FeeLike {
  status: string;
  amount: number;
}
export interface SettlementLike {
  status: string;
  settledAmount: number;
  savingsAmount: number;
  payoffPaidDate?: Date | null;
}

export interface PaymentRollup {
  totalCollected: number;
  totalDisbursed: number;
  totalFees: number;
  totalSettled: number;
  totalSavings: number;
  draftSuccessCount: number;
  draftFailedCount: number;
  lastDraftDate: Date | null;
}

export function rollupPayments(args: {
  drafts: readonly DraftLike[];
  fees: readonly FeeLike[];
  settlements: readonly SettlementLike[];
}): PaymentRollup {
  let totalCollected = 0;
  let draftSuccessCount = 0;
  let draftFailedCount = 0;
  let lastDraftDate: Date | null = null;

  for (const d of args.drafts) {
    if (d.status === "SUCCESS") {
      totalCollected += d.amount;
      draftSuccessCount++;
      if (d.settledAt && (!lastDraftDate || d.settledAt > lastDraftDate)) {
        lastDraftDate = d.settledAt;
      }
    } else if (d.status === "FAILED") {
      draftFailedCount++;
    }
  }

  let totalFees = 0;
  for (const f of args.fees) {
    if (f.status === "CHARGED") totalFees += f.amount;
  }

  let totalSettled = 0;
  let totalSavings = 0;
  let totalDisbursed = 0;
  for (const s of args.settlements) {
    totalSettled += s.settledAmount;
    totalSavings += s.savingsAmount;
    if (s.status === "PAID") totalDisbursed += s.settledAmount;
  }

  return {
    totalCollected,
    totalDisbursed,
    totalFees,
    totalSettled,
    totalSavings,
    draftSuccessCount,
    draftFailedCount,
    lastDraftDate,
  };
}
