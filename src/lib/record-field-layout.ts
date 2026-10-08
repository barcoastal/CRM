import catalog from "./record-field-catalog.json";
import { LEAD_STATUSES, OPP_STAGES, ACCOUNT_STAGES } from "./sf-canonical";
import { NEGOTIATION_STAGES } from "./negotiation-workflow";
export { catalog as fieldCatalog };
export type LayoutEntity = keyof typeof catalog;
export type FieldPlacement = { id: string; hidden: boolean; required?: boolean; span: 1 | 2 };
export type GridLayout = { columns: 1 | 2; fields: FieldPlacement[] };
export type RecordFieldLayout = Record<string, GridLayout>;
export const layoutStages: Record<LayoutEntity, readonly string[]> = { Lead: LEAD_STATUSES, Account: ACCOUNT_STAGES, Opportunity: OPP_STAGES, Negotiation: NEGOTIATION_STAGES };
export const layoutId = (entity: LayoutEntity, stage: string) => `record-fields:${entity}:${stage}`;
export function isLayoutEntity(value: string): value is LayoutEntity { return Object.hasOwn(catalog, value); }
export function defaultFieldLayout(entity: LayoutEntity): RecordFieldLayout {
  return Object.fromEntries(catalog[entity].map(group => [group.id, { columns: group.columns as 1 | 2, fields: group.fields.map(field => ({ id: field.id, hidden: false, required: false, span: 1 })) }]));
}
export function validateFieldLayout(entity: LayoutEntity, input: unknown): RecordFieldLayout {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid layout");
  const output: RecordFieldLayout = {};
  for (const [key, value] of Object.entries(input)) {
    const group = catalog[entity].find(group => group.id === key);
    if (!group || !value || typeof value !== "object") throw new Error("Unknown section");
    const grid = value as GridLayout;
    if (![1, 2].includes(grid.columns) || !Array.isArray(grid.fields)) throw new Error("Invalid section");
    const seen = new Set<string>();
    const fields = grid.fields.map(field => {
      if (!field || !group.fields.some(known => known.id === field.id) || seen.has(field.id) || typeof field.hidden !== "boolean" || ![1, 2].includes(field.span)) throw new Error("Invalid field placement");
      if (field.required !== undefined && typeof field.required !== "boolean") throw new Error("Invalid requirement");
      if (field.required && (field.hidden || !group.fields.find(known => known.id === field.id)?.requirementKey)) throw new Error("Required fields must be visible and supported");
      seen.add(field.id);
      return { id: field.id, hidden: field.hidden, required: field.required ?? false, span: field.span };
    });
    output[key] = { columns: grid.columns, fields };
  }
  return output;
}
/** New fields retain their original position after saved fields, and never disappear silently. */
export function arrangeFields<T>(fields: T[], label: (field: T) => string, layout?: GridLayout): { field: T; span: 1 | 2 }[] {
  if (!layout) return fields.map(field => ({ field, span: 1 }));
  const positions = new Map(layout.fields.map((field, index) => [field.id, { ...field, index }]));
  return fields.map((field, index) => ({ field, index, placement: positions.get(label(field)) }))
    .filter(row => label(row.field) !== "" && !row.placement?.hidden)
    .sort((a, b) => (a.placement?.index ?? layout.fields.length + a.index) - (b.placement?.index ?? layout.fields.length + b.index))
    .map(row => ({ field: row.field, span: row.placement?.span ?? 1 }));
}
