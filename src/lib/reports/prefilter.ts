import type { ObjectField } from "./object-metadata";
import type { ReportFilter } from "./runner";
/** Only exact scalar predicates are pushed down. Partial OR branches must never exclude matches. */
export function reportPrefilter(filters: ReportFilter[], fields: Map<string, ObjectField>): Record<string, unknown> {
  function clause(filter: ReportFilter): Record<string, unknown> | null {
    const field = fields.get(filter.field);
    if (!field || field.source !== "column" || field.key.includes(".") || filter.operator.startsWith("is")) return null;
    const op = filter.operator;
    if (["contains","startsWith","endsWith"].includes(op) && field.type !== "string") return null;
    const coerce = (value: unknown): unknown => {
      if (field.type === "date") {const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? date : undefined;}
      if (field.type === "number") {const number = Number(value); return Number.isFinite(number) ? number : undefined;}
      if (field.type === "boolean") return value === true || value === "true" ? true : value === false || value === "false" ? false : undefined;
      return typeof value === "string" ? value : undefined;
    };
    const raw = op === "in" || op === "notIn" ? (Array.isArray(filter.value) ? filter.value : String(filter.value).split(",").map(v => v.trim())) : null;
    const value = raw ? raw.map(coerce) : coerce(filter.value);
    if (value === undefined || (Array.isArray(value) && value.some(v => v === undefined))) return null;
    // Prisma not/notIn exclude SQL nulls; post-filter semantics include null when not equal.
    if (op === "not" || op === "notIn") return null;
    return { [filter.field]: { [op]: value, ...(["contains","startsWith","endsWith"].includes(op) ? {mode:"insensitive"} : {}) } };
  }
  const and: Record<string, unknown>[] = [], groups = new Map<string, (Record<string, unknown> | null)[]>();
  for (const filter of filters) {const part = clause(filter); if (filter.orGroup) {const list=groups.get(filter.orGroup)??[];list.push(part);groups.set(filter.orGroup,list);} else if (part) and.push(part);}
  if (groups.size && [...groups.values()].every(parts => parts.every(Boolean))) and.push({OR:[...groups.values()].map(parts => ({AND:parts}))});
  return {AND:and};
}
