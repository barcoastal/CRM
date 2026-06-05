/**
 * ProgramPlanTrigger — port of SF ProgramPlanTriggerHandler.cls
 *
 * Source: docs/sf-export/sfdx-raw/triggers/ProgramPlanTrigger.trigger
 *
 * SF logic:
 *   beforeInsert / beforeUpdate / beforeDelete:
 *     If the parent Opportunity is locked, block the operation.
 *
 * In SF, "locked" means the Opp is at a stage that disallows downstream
 * edits (typically Closed Won / Closed Lost). We use Opportunity.stage in
 * the OPP_STAGE_FINAL_WIN family for the same purpose.
 */

import type { Trigger, TriggerCtx } from "./types";
import type { ProgramPlan } from "@/generated/prisma/client";

type ProgramPlanWrite = Partial<ProgramPlan> & Record<string, unknown>;

const LOCKED_OPP_STAGES = new Set([
  "Closed Won - First Payment Completed",
  "Closed Lost",
  "Archived",
]);

async function assertParentOppEditable(
  opportunityId: string | null | undefined,
  ctx: TriggerCtx,
): Promise<void> {
  if (!opportunityId) return;
  const opp = await ctx.prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { stage: true },
  });
  if (opp?.stage && LOCKED_OPP_STAGES.has(opp.stage)) {
    throw new Error(`Cannot modify ProgramPlan: parent Opportunity is locked (stage: ${opp.stage})`);
  }
}

export const programPlanTrigger: Trigger<ProgramPlan, ProgramPlanWrite> = {
  async beforeInsert({ next, ctx }) {
    await assertParentOppEditable(next.opportunityId as string | undefined, ctx);
  },

  async beforeUpdate({ next, prev, ctx }) {
    const oppId = (next.opportunityId as string | undefined) ?? prev.opportunityId;
    await assertParentOppEditable(oppId, ctx);
  },
};
