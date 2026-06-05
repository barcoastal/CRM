/**
 * Port of SF OpportunityTrigger / OpportunityTriggerHandler.
 * Source: docs/sf-export/sfdx-raw/classes/OpportunityTriggerHandler.cls
 *
 * Ported behaviors:
 *  - beforeUpdate:
 *    - Stage change → store previous stage into Opportunity.lastDisposition
 *      and timestamp Opportunity.lastDispositionAt
 *
 *  - afterUpdate:
 *    - Stage change → create a Task ("Stage Changed to X") unless the caller
 *      passed Opportunity:<id>:task into ctx.skip
 *    - Stage change → write an OpportunityHistory row
 *
 * Skipped (handled elsewhere or out of scope):
 *  - Stage transition validation via PicklistValueTransitionHelper (SF-specific)
 *  - Five9 list sync (Phase D)
 *  - Email notification "Opportunity Stage Update" (Phase F — flows)
 *  - Closed Won First Payment Pending cascade to Client (already handled in
 *    /api/opportunities/[id]/disposition for the Closed Won - First Payment
 *    Completed stage)
 */

import type { Opportunity } from "@/generated/prisma/client";
import type { Trigger } from "./types";

type OppWrite = Partial<Opportunity> & Record<string, unknown>;

export const opportunityTrigger: Trigger<Opportunity, OppWrite> = {
  beforeUpdate({ next, prev }) {
    if (next.stage !== undefined && next.stage !== prev.stage) {
      next.lastDisposition = prev.stage;
      next.lastDispositionAt = new Date();
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    // Primary contact changed → mirror to Account.primaryContactId
    // Port of SF OpportunityContactRoleTriggerHandler.assignPrimaryContactInAccount
    if (row.primaryContactId !== prev.primaryContactId && row.primaryContactId && row.accountId) {
      await ctx.prisma.account.update({
        where: { id: row.accountId },
        data: { primaryContactId: row.primaryContactId },
      }).catch(() => undefined);
    }

    const stageChanged = row.stage !== prev.stage;
    if (!stageChanged) return;

    await ctx.prisma.opportunityHistory.create({
      data: {
        opportunityId: row.id,
        field: "Stage",
        oldValue: prev.stage,
        newValue: row.stage,
        changedById: ctx.userId,
      },
    });

    const taskSkip = `Opportunity:${row.id}:task`;
    if (!ctx.skip.has(taskSkip)) {
      await ctx.prisma.task.create({
        data: {
          recordType: "DISPOSITION",
          subject: `Stage Changed to ${row.stage}`,
          type: "TASK",
          status: "COMPLETED",
          opportunityId: row.id,
          leadId: row.leadId,
          ownerId: ctx.userId,
          notes: `Opportunity Stage changed from ${prev.stage ?? "—"} to ${row.stage ?? "—"}`,
          completedAt: new Date(),
        },
      });
    }
  },
};
