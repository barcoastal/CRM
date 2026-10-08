import { fieldCatalog, layoutStages, type LayoutEntity, type RecordFieldLayout } from "./record-field-layout";
import { negotiationStage } from "./negotiation-workflow";
import { isFieldFilled } from "./path/field-values";

export function recordStage(entity: LayoutEntity, record: Record<string, unknown>): string {
  if (entity === "Negotiation") return negotiationStage(record.negotiationStatus as string | null, record.status as string) ?? String(record.negotiationStatus ?? "Not Started");
  const raw = entity === "Lead" ? record.status ?? "New" : entity === "Account" ? record.clientStatus ?? record.stage ?? "Inactive" : record.stage ?? "Working Opportunity";
  const normalized = String(raw).toLowerCase().replace(/_/g, " ").trim();
  if (entity === "Lead") {
    if (["qualified", "contacted", "callback"].includes(normalized)) return "Working Lead";
    if (["dnc", "lost", "unqualified"].includes(normalized)) return "Archive Disposition";
    if (["enrolled", "opportunity"].includes(normalized)) return "Converted";
  }
  return layoutStages[entity].find(stage => stage.toLowerCase() === normalized) ?? String(raw);
}
export function requirementValue(record: Record<string, unknown>, path: string): unknown {
  let value: unknown = record;
  for (const key of path.split(".")) {
    if (typeof value === "string") { try { value = JSON.parse(value); } catch { return undefined; } }
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function missingStageFields(entity: LayoutEntity, layout: RecordFieldLayout, record: Record<string, unknown>): string[] {
  const missing = new Set<string>();
  for (const group of fieldCatalog[entity]) {
    for (const field of layout[group.id]?.fields ?? []) {
      if (!field.required) continue;
      const key = group.fields.find(known => known.id === field.id)?.requirementKey;
      if (key && !isFieldFilled(requirementValue(record, key))) missing.add(field.id);
    }
  }
  return [...missing];
}
