import "server-only";
import { recordStage } from "./stage-requirements";
import { prisma } from "./prisma";
import { layoutId, type LayoutEntity, type RecordFieldLayout, validateFieldLayout } from "./record-field-layout";
export async function getRecordFieldLayouts(entity: LayoutEntity): Promise<Record<string, RecordFieldLayout>> {
  const rows = await prisma.pageLayout.findMany({ where: { id: { startsWith: `record-fields:${entity}:` }, entityType: entity } });
  const result: Record<string, RecordFieldLayout> = {};
  for (const row of rows) {
    try { result[row.id.slice(layoutId(entity, "").length)] = validateFieldLayout(entity, row.layout); }
    catch { /* An invalid saved layout must not make records inaccessible. */ }
  }
  return result;
}
export async function getRecordFieldLayout(entity: LayoutEntity, stage: string | null): Promise<RecordFieldLayout> {
  const layouts = await getRecordFieldLayouts(entity);
  const normalized = stage ? recordStage(entity, { status: stage, stage, clientStatus: stage, negotiationStatus: stage }) : "*";
  return layouts[normalized] ?? layouts["*"] ?? {};
}
