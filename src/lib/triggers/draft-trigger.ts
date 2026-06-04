/**
 * Port of SF draftTrigger / DraftTriggerHandler.
 * Source: docs/sf-export/sfdx-raw/classes/DraftTriggerHandler.cls
 *
 * Ported behaviors:
 *  - afterUpdate / afterInsert:
 *    - When a Draft transitions to SUCCESS:
 *      - increment ProgramPlan.completedPaymentsCount
 *      - if this is the first successful draft on the parent Account, set
 *        Account.firstPaymentReceived = true (via cascading update on its
 *        ProgramPlan → Account)
 *      - set ProgramPlan.firstDraftDate to this draft's scheduledDate if unset
 *    - When a Draft transitions to FAILED:
 *      - increment ProgramPlan.failedPaymentsCount
 *
 * Skipped:
 *  - SAS / RAM payment-processor sync (Phase C)
 *  - Sync_Status flagging (handled at endpoint level in Phase C)
 */

import type { Draft } from "@/generated/prisma/client";
import type { Trigger } from "./types";

type DraftWrite = Partial<Draft> & Record<string, unknown>;

export const draftTrigger: Trigger<Draft, DraftWrite> = {
  async afterUpdate({ row, prev, ctx }) {
    if (row.status === prev.status) return;

    if (row.status === "SUCCESS") {
      // Bump completed count and first draft date on the program plan
      const plan = await ctx.prisma.programPlan.findUnique({
        where: { id: row.programPlanId },
        select: { id: true, accountId: true, firstDraftDate: true },
      });
      if (!plan) return;

      await ctx.prisma.programPlan.update({
        where: { id: plan.id },
        data: {
          completedPaymentsCount: { increment: 1 },
          ...(plan.firstDraftDate ? {} : { firstDraftDate: row.scheduledDate }),
        },
      });

      // First successful draft → mark Account.firstPaymentReceived
      await ctx.prisma.account.update({
        where: { id: plan.accountId },
        data: { firstPaymentReceived: true },
      });
    } else if (row.status === "FAILED") {
      await ctx.prisma.programPlan.update({
        where: { id: row.programPlanId },
        data: { failedPaymentsCount: { increment: 1 } },
      });
    }
  },

  async afterInsert({ row, ctx }) {
    if (row.status === "SUCCESS") {
      const plan = await ctx.prisma.programPlan.findUnique({
        where: { id: row.programPlanId },
        select: { id: true, accountId: true, firstDraftDate: true },
      });
      if (!plan) return;
      await ctx.prisma.programPlan.update({
        where: { id: plan.id },
        data: {
          completedPaymentsCount: { increment: 1 },
          ...(plan.firstDraftDate ? {} : { firstDraftDate: row.scheduledDate }),
        },
      });
      await ctx.prisma.account.update({
        where: { id: plan.accountId },
        data: { firstPaymentReceived: true },
      });
    }
  },
};
