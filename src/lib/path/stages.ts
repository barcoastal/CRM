import { LEAD_STATUSES, OPP_STAGES, ACCOUNT_STAGES } from "@/lib/sf-canonical";
import type { EntityKey } from "./field-labels";

/**
 * The exact stage labels the Path component renders per entity. These match
 * the picklist values in sf-canonical.ts (Lead.Status, Opportunity.Stage,
 * Account.Stage) plus the static Case stage progression in the Case detail
 * page. Used to populate the Settings → Path Guidance "Stage" dropdown so
 * editors can't typo a stage label.
 */
const CASE_STAGES = ["New", "In Progress", "Escalated", "Resolved"] as const;

export const ENTITY_STAGES: Record<EntityKey, readonly string[]> = {
  Lead: LEAD_STATUSES,
  Opportunity: OPP_STAGES,
  Account: ACCOUNT_STAGES,
  Case: CASE_STAGES,
};

export function getStagesForEntity(entity: EntityKey): readonly string[] {
  return ENTITY_STAGES[entity] ?? [];
}
