import type { Trigger } from "./types";
import { leadTrigger } from "./lead-trigger";
import { opportunityTrigger } from "./opportunity-trigger";
import { accountTrigger } from "./account-trigger";
import { draftTrigger } from "./draft-trigger";
import { taskTrigger } from "./task-trigger";
import { contactTrigger } from "./contact-trigger";

/**
 * Map of model name (lowercase Prisma model name) → trigger module.
 * Wire each ported trigger here once it's ready.
 */
export const TRIGGERS: Record<string, Trigger<unknown> | undefined> = {
  lead: leadTrigger as unknown as Trigger<unknown>,
  opportunity: opportunityTrigger as unknown as Trigger<unknown>,
  account: accountTrigger as unknown as Trigger<unknown>,
  draft: draftTrigger as unknown as Trigger<unknown>,
  task: taskTrigger as unknown as Trigger<unknown>,
  contact: contactTrigger as unknown as Trigger<unknown>,
};

export function getTrigger(model: string): Trigger<unknown> | undefined {
  return TRIGGERS[model.toLowerCase()];
}
