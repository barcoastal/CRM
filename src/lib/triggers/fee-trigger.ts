/**
 * Port of SF feeTrigger / FeeTriggerHandler / FeeAfterTriggerHelper.
 * Source: docs/sf-export/sfdx-raw/classes/FeeAfterTriggerHelper.cls
 *
 * Ported behaviors:
 *  - afterInsert / afterUpdate / afterDelete: when any Fee on a ProgramPlan
 *    changes (amount or status), recompute the PaymentSummary for the
 *    parent Account: totalFees = sum of all CHARGED fees on all program
 *    plans for that account.
 *
 * The PaymentSummary model also tracks totalCollected / totalDisbursed /
 * totalSettled, which are populated by other triggers (Draft, Settlement).
 * This trigger only owns totalFees.
 */

import type { Fee } from "@/generated/prisma/client";
import type { Trigger, TriggerCtx } from "./types";

type FeeWrite = Partial<Fee> & Record<string, unknown>;

async function recomputeAccountFees(programPlanId: string, ctx: TriggerCtx) {
  const plan = await ctx.prisma.programPlan.findUnique({
    where: { id: programPlanId },
    select: { accountId: true },
  });
  if (!plan?.accountId) return;

  // Sum CHARGED fees across all program plans on this account
  const sum = await ctx.prisma.fee.aggregate({
    where: {
      programPlan: { accountId: plan.accountId },
      status: "CHARGED",
    },
    _sum: { amount: true },
  });
  const totalFees = sum._sum.amount ?? 0;

  await ctx.prisma.paymentSummary.upsert({
    where: { accountId: plan.accountId },
    create: { accountId: plan.accountId, totalFees },
    update: { totalFees },
  });
}

export const feeTrigger: Trigger<Fee, FeeWrite> = {
  async afterInsert({ row, ctx }) {
    await recomputeAccountFees(row.programPlanId, ctx);
  },
  async afterUpdate({ row, prev, ctx }) {
    const changed =
      row.amount !== prev.amount ||
      row.status !== prev.status ||
      row.programPlanId !== prev.programPlanId;
    if (!changed) return;
    await recomputeAccountFees(row.programPlanId, ctx);
    if (row.programPlanId !== prev.programPlanId) {
      await recomputeAccountFees(prev.programPlanId, ctx);
    }
  },
  async afterDelete({ row, ctx }) {
    await recomputeAccountFees(row.programPlanId, ctx);
  },
};
