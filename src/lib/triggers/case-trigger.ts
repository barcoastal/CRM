import { AutomationValidationError } from "@/lib/automation/errors";
import { prepareCaseApproval, submitNewCase, assertCaseEditable } from "@/lib/automation/case-approvals";
/**
 * Case trigger module.
 *
 * Today this only hosts the admin-authored Validation Rules hook. Add SF
 * parity behavior here (status change history, escalation, owner change
 * notifications) when porting CaseTriggerHandler.
 */

import type { Case } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { runRulesFor } from "@/lib/validation-rules/evaluator";

type CaseWrite = Partial<Case> & Record<string, unknown>;

export const caseTrigger: Trigger<Case, CaseWrite> = {
  async beforeInsert({ next, ctx }) {
    const vr = await runRulesFor("Case", next as Record<string, unknown>, "insert");
    if (!vr.ok) throw new AutomationValidationError(vr.message);
    await prepareCaseApproval(next, ctx.userId, ctx.prisma);
  },

  async beforeUpdate({ next, prev, ctx }) {
    await assertCaseEditable(prev.id, ctx.userId, ctx.prisma);
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Case", proposed, "update");
    if (!vr.ok) throw new AutomationValidationError(vr.message);
  },
  async afterInsert({ row, ctx }) { await submitNewCase(row, ctx); },
};
