import type { Trigger } from "./types";
import { leadTrigger } from "./lead-trigger";

/**
 * Map of model name (lowercase Prisma model name) → trigger module.
 * Wire each ported trigger here once it's ready.
 */
export const TRIGGERS: Record<string, Trigger<unknown> | undefined> = {
  lead: leadTrigger as unknown as Trigger<unknown>,
  // opportunity: opportunityTrigger,
  // account: accountTrigger,
  // draft: draftTrigger,
  // ...
};

export function getTrigger(model: string): Trigger<unknown> | undefined {
  return TRIGGERS[model.toLowerCase()];
}
