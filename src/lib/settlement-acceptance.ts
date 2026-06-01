import { prisma } from "@/lib/prisma";
import { isSettlementRecordType, type SettlementRecordType } from "@/lib/record-types";
import { auditWrite } from "@/lib/audit";

export interface AcceptOfferOptions {
  recordType?: SettlementRecordType;
  payoffDueDate?: Date | null;
  notes?: string;
  approvedById?: string;
  performedById?: string;
}

export interface AcceptOfferResult {
  settlementId: string;
  debtId: string;
  alreadyAccepted: boolean;
}

/**
 * Accept an Offer → produce a Settlement → update the Debt.
 * Transactional. Idempotent (re-accept returns the existing Settlement).
 */
export async function acceptOffer(
  offerId: string,
  opts: AcceptOfferOptions = {},
): Promise<AcceptOfferResult> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { settlement: true, debt: true },
  });
  if (!offer) throw new Error(`Offer ${offerId} not found`);
  if (offer.settlement) {
    return {
      settlementId: offer.settlement.id,
      debtId: offer.debtId,
      alreadyAccepted: true,
    };
  }

  if (offer.status === "WITHDRAWN" || offer.status === "EXPIRED" || offer.status === "REJECTED") {
    throw new Error(`Cannot accept offer in status ${offer.status}`);
  }

  const recordType: SettlementRecordType =
    opts.recordType && isSettlementRecordType(opts.recordType) ? opts.recordType : "STANDARD";

  const settlementResult = await prisma.$transaction(async (tx) => {
    const settledAmount = offer.amountOffered;
    const currentBalance = offer.debt.currentBalance ?? offer.debt.originalBalance ?? 0;
    const savingsAmount = Math.max(currentBalance - settledAmount, 0);
    const savingsPercent = currentBalance > 0 ? savingsAmount / currentBalance : 0;

    const settlement = await tx.settlement.create({
      data: {
        debtId: offer.debtId,
        offerId: offer.id,
        recordType,
        settledAmount,
        savingsAmount,
        savingsPercent,
        settledDate: new Date(),
        payoffDueDate: opts.payoffDueDate ?? null,
        status: "PENDING_PAYOFF",
        approvedById: opts.approvedById ?? null,
        notes: opts.notes ?? null,
      },
    });

    await tx.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
    await tx.debt.update({
      where: { id: offer.debtId },
      data: {
        status: "SETTLED",
        settledAmount,
        savingsAmount,
        savingsPercent,
        settledDate: settlement.settledDate,
      },
    });

    return settlement;
  });

  await auditWrite({
    userId: opts.performedById ?? opts.approvedById ?? null,
    entity: "Settlement",
    entityId: settlementResult.id,
    action: "CREATE",
    after: {
      source: "accept-offer",
      offerId: offer.id,
      debtId: offer.debtId,
      settledAmount: settlementResult.settledAmount,
    },
  }).catch(() => null);

  return {
    settlementId: settlementResult.id,
    debtId: offer.debtId,
    alreadyAccepted: false,
  };
}
