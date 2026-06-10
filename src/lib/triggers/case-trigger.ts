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
  async beforeInsert({ next }) {
    const vr = await runRulesFor("Case", next as Record<string, unknown>, "insert");
    if (!vr.ok) throw new Error(vr.message);
  },

  async beforeUpdate({ next, prev }) {
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Case", proposed, "update");
    if (!vr.ok) throw new Error(vr.message);
  },
};
