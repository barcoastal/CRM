import { prisma } from "./prisma";
import { type LayoutEntity, type RecordFieldLayout, layoutId, validateFieldLayout, fieldCatalog } from "./record-field-layout";
import { missingStageFields, recordStage } from "./stage-requirements";
import { AutomationValidationError } from "./automation/errors";

/** Check stage entry, allowing users to fill missing fields one at a time in an existing stage. */
export async function assertStageRequirements(entity: LayoutEntity, next: Record<string, unknown>, previous?: Record<string, unknown>): Promise<void> {
  const stage = recordStage(entity, next);
  if (previous && recordStage(entity, previous) === stage) return;
  const rows = await prisma.pageLayout.findMany({ where: { id: { in: [layoutId(entity, stage), layoutId(entity, "*")] }, entityType: entity } });
  const row = rows.find(row => row.id === layoutId(entity, stage)) ?? rows.find(row => row.id === layoutId(entity, "*"));
  if (!row) return;
  // Fail closed if an active saved requirement configuration cannot be read.
  const layout: RecordFieldLayout = validateFieldLayout(entity, row.layout);
  let record = next;
  const needsAccount = fieldCatalog[entity].some(group => group.fields.some(field => field.requirementKey?.startsWith("account.") && layout[group.id]?.fields.some(slot => slot.id === field.id && slot.required)));
  if (needsAccount && !next.account && typeof next.accountId === "string") {
    const account = await prisma.account.findUnique({ where: { id: next.accountId } });
    record = { ...next, account };
  }
  const missing = missingStageFields(entity, layout, record);
  if (missing.length) throw new AutomationValidationError(`Complete ${missing.join(", ")} before entering ${stage}.`);
}
