// Report runner: takes a ReportConfig (object + columns + filters + grouping +
// summarize) and returns rows ready for the UI. The runner uses Prisma's
// findMany with dynamic include + where, then post-processes in JS for JSON
// path resolution, grouping, and summarize math.

import { prisma } from "@/lib/prisma";
import {
  getObjectMetadata,
  getField,
  type ObjectField,
  type ObjectMetadata,
} from "./object-metadata";

export interface ReportFilter {
  field: string;
  operator: string;
  value: unknown;
  /**
   * SF-style boolean groups: filters sharing a group are ANDed together and
   * the groups OR with each other; ungrouped filters AND with the OR result.
   * Mirrors booleanFilter shapes like "(1 AND 2) OR (1 AND 3)".
   */
  orGroup?: string;
}

export interface ReportSummarize {
  field: string;
  kind: "count" | "sum" | "avg";
}

export interface ReportConfig {
  objectType: string;
  columns: string[];
  filters: ReportFilter[];
  groupBy?: string | null;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  summarize?: ReportSummarize[];
  rowLimit?: number;
}

export interface ReportResultGroup {
  key: string;
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
}

export interface ReportResultColumn {
  key: string;
  label: string;
}

export interface ReportResult {
  columns: ReportResultColumn[];
  rows: Record<string, unknown>[];
  groups?: ReportResultGroup[];
  totals?: Record<string, unknown>;
  rowCount: number;
}

export type ReportRunOutcome = ReportResult | { error: string };

const MAX_ROW_LIMIT = 10000;

const OPERATORS = new Set([
  "equals",
  "not",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "isNull",
  "isNotNull",
]);

// ── Filter -> Prisma where ─────────────────────────────────────────────

function coerceValue(field: ObjectField, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") return raw;
  if (field.type === "number") {
    if (Array.isArray(raw)) return raw.map((v) => Number(v));
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (field.type === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === "false" || raw === 0 || raw === "0") return false;
    return raw;
  }
  if (field.type === "date") {
    if (raw instanceof Date) return raw;
    if (typeof raw === "string") {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? raw : d;
    }
  }
  return raw;
}

function setNested(target: Record<string, unknown>, path: string[], value: unknown) {
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (typeof cur[seg] !== "object" || cur[seg] === null) cur[seg] = {};
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

function buildFilterClause(field: ObjectField, operator: string, value: unknown): Record<string, unknown> | null {
  // JSON-path filters: prefilter in the DB via substring match on the raw JSON
  // text (sync writes compact JSON, so "Key":"Value" hits the exact key). The
  // JS post-filter still runs after fetch for exactness; without the DB
  // prefilter, only the newest rowLimit rows would ever be scanned.
  if (field.source === "json") {
    const jsonCol = field.jsonColumn;
    if (!jsonCol) return null;
    const jsonKey = field.key.startsWith(`${jsonCol}.`)
      ? field.key.slice(jsonCol.length + 1)
      : field.key;
    const pat = (v: unknown) => `"${jsonKey}":${JSON.stringify(String(v))}`;
    switch (operator) {
      case "equals":
        return { [jsonCol]: { contains: pat(value) } };
      case "in":
        return Array.isArray(value) && value.length > 0
          ? { OR: value.map((v) => ({ [jsonCol]: { contains: pat(v) } })) }
          : null;
      case "contains":
        return { [jsonCol]: { contains: String(value) } };
      case "isNotNull":
        return { AND: [{ [jsonCol]: { contains: `"${jsonKey}":` } }, { NOT: { [jsonCol]: { contains: `"${jsonKey}":""` } } }] };
      default:
        return null; // ranges etc. stay JS-side only
    }
  }
  // Computed filters are JS-side.
  if (field.source === "computed") return null;

  const coerced = coerceValue(field, value);

  let leaf: Record<string, unknown>;
  switch (operator) {
    case "equals":
      leaf = { equals: coerced };
      break;
    case "not":
      leaf = { not: coerced };
      break;
    case "contains":
      leaf = field.type === "string" ? { contains: String(coerced), mode: "insensitive" } : { equals: coerced };
      break;
    case "startsWith":
      leaf = { startsWith: String(coerced), mode: "insensitive" };
      break;
    case "endsWith":
      leaf = { endsWith: String(coerced), mode: "insensitive" };
      break;
    case "gt":
      leaf = { gt: coerced };
      break;
    case "gte":
      leaf = { gte: coerced };
      break;
    case "lt":
      leaf = { lt: coerced };
      break;
    case "lte":
      leaf = { lte: coerced };
      break;
    case "in": {
      const arr = Array.isArray(coerced) ? coerced : String(coerced ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      leaf = { in: arr };
      break;
    }
    case "notIn": {
      const arr = Array.isArray(coerced) ? coerced : String(coerced ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      leaf = { notIn: arr };
      break;
    }
    case "isNull":
      leaf = { equals: null };
      break;
    case "isNotNull":
      leaf = { not: null };
      break;
    default:
      return null;
  }

  const path = field.key.split(".");
  const out: Record<string, unknown> = {};
  setNested(out, path, leaf);
  return out;
}

// ── Build the Prisma query ─────────────────────────────────────────────

function buildInclude(meta: ObjectMetadata, columns: string[], filters: ReportFilter[], groupBy?: string | null, sortBy?: string | null): Record<string, unknown> | undefined {
  const relations = new Set<string>();
  const collect = (key: string) => {
    const field = meta.fields.find((f) => f.key === key);
    if (field?.source === "relation" && field.relation) relations.add(field.relation);
  };
  columns.forEach(collect);
  filters.forEach((f) => collect(f.field));
  if (groupBy) collect(groupBy);
  if (sortBy) collect(sortBy);

  if (relations.size === 0) return undefined;
  const include: Record<string, unknown> = {};
  for (const r of relations) include[r] = true;
  return include;
}

// ── Resolve a dot path against a row ───────────────────────────────────

function resolveValue(row: Record<string, unknown>, key: string, field: ObjectField | null): unknown {
  if (!field) {
    return resolvePath(row, key);
  }
  if (field.source === "column" || field.source === "relation") {
    return resolvePath(row, key);
  }
  if (field.source === "json" && field.jsonColumn) {
    const raw = row[field.jsonColumn];
    if (raw == null) return null;
    let parsed: unknown = null;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
    } else if (typeof raw === "object") {
      parsed = raw;
    }
    // Strip jsonColumn from path
    const sub = field.key.split(".").slice(1).join(".");
    return resolvePath(parsed as Record<string, unknown>, sub);
  }
  return null;
}

function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return null;
  const segs = path.split(".");
  let cur: unknown = obj;
  for (const seg of segs) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur ?? null;
}

// ── Group / summarize helpers ──────────────────────────────────────────

function groupKey(value: unknown): string {
  if (value === null || value === undefined) return "(blank)";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function computeSummary(
  rows: Record<string, unknown>[],
  summarize: ReportSummarize[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { _count: rows.length };
  for (const s of summarize) {
    if (s.kind === "count") {
      // count of non-null values for the field
      let n = 0;
      for (const r of rows) if (r[s.field] !== null && r[s.field] !== undefined) n++;
      out[`${s.field}_count`] = n;
      continue;
    }
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const v = r[s.field];
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) {
        sum += n;
        count++;
      }
    }
    if (s.kind === "sum") out[`${s.field}_sum`] = sum;
    if (s.kind === "avg") out[`${s.field}_avg`] = count > 0 ? sum / count : 0;
  }
  return out;
}

// ── Main entry ─────────────────────────────────────────────────────────

export async function runReport(cfg: ReportConfig): Promise<ReportRunOutcome> {
  try {
    const meta = getObjectMetadata(cfg.objectType);
    if (!meta) return { error: `Unknown objectType: ${cfg.objectType}` };

    // Validate columns
    const knownKeys = new Set(meta.fields.map((f) => f.key));
    const columns = cfg.columns.filter((c) => knownKeys.has(c));
    if (columns.length === 0) {
      // Fall back to defaults so the user always sees something
      columns.push(...meta.defaultColumns.filter((c) => knownKeys.has(c)));
    }

    // Validate filters — drop unknown fields and operators silently
    const filters: ReportFilter[] = [];
    for (const f of cfg.filters ?? []) {
      if (!knownKeys.has(f.field)) continue;
      if (!OPERATORS.has(f.operator)) continue;
      filters.push(f);
    }

    const groupBy = cfg.groupBy && knownKeys.has(cfg.groupBy) ? cfg.groupBy : null;
    const sortBy = cfg.sortBy && knownKeys.has(cfg.sortBy) ? cfg.sortBy : null;
    const sortDir = cfg.sortDir === "desc" ? "desc" : "asc";

    // Build where from DB-level filters (column + relation). JSON / computed
    // are applied after fetch.
    const whereClauses: Record<string, unknown>[] = [];
    const groupClauses = new Map<string, Record<string, unknown>[]>();
    const postFilters: ReportFilter[] = [];
    for (const f of filters) {
      const field = getField(cfg.objectType, f.field);
      if (!field) continue;
      const clause = buildFilterClause(field, f.operator, f.value);
      // json/computed filters always post-filter too (DB clause is a prefilter)
      if (field.source === "json" || field.source === "computed") postFilters.push(f);
      if (!clause) { if (field.source !== "json" && field.source !== "computed") postFilters.push(f); continue; }
      if (f.orGroup) {
        const list = groupClauses.get(f.orGroup) ?? [];
        list.push(clause);
        groupClauses.set(f.orGroup, list);
      } else {
        whereClauses.push(clause);
      }
    }
    // OR the groups together (each group internally ANDed), then AND with the rest.
    if (groupClauses.size > 0) {
      const orParts = [...groupClauses.values()].map((list) =>
        list.length === 1 ? list[0] : { AND: list },
      );
      whereClauses.push(orParts.length === 1 ? orParts[0] : { OR: orParts });
    }
    const where: Record<string, unknown> = whereClauses.length === 1
      ? whereClauses[0]
      : whereClauses.length > 1
        ? { AND: whereClauses }
        : {};

    const include = buildInclude(meta, columns, filters, groupBy, sortBy);

    // orderBy: support relation.subfield (e.g. owner.name) by nesting
    let orderBy: Record<string, unknown> = { createdAt: "desc" };
    if (sortBy) {
      const sortField = getField(cfg.objectType, sortBy);
      if (sortField) {
        if (sortField.source === "relation") {
          const path = sortBy.split(".");
          const nested: Record<string, unknown> = {};
          setNested(nested, path, sortDir);
          orderBy = nested;
        } else if (sortField.source === "column") {
          orderBy = { [sortBy]: sortDir };
        } else {
          // json / computed sorts are post-processed
          orderBy = { createdAt: "desc" };
        }
      }
    }

    const take = Math.min(Math.max(1, cfg.rowLimit ?? 2000), MAX_ROW_LIMIT);

    // Run prisma findMany dynamically
    const delegate = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]> }>)[meta.prismaModel];
    if (!delegate?.findMany) {
      return { error: `Prisma model not available: ${meta.prismaModel}` };
    }
    const args: Record<string, unknown> = { where, take, orderBy };
    if (include) args.include = include;

    const dbRows = (await delegate.findMany(args)) as Record<string, unknown>[];

    // Project to flat rows
    let flatRows: Record<string, unknown>[] = dbRows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const colKey of columns) {
        const field = getField(cfg.objectType, colKey);
        out[colKey] = resolveValue(r, colKey, field);
      }
      // Also resolve fields used in groupBy / summarize / postFilters
      if (groupBy && !(groupBy in out)) {
        const field = getField(cfg.objectType, groupBy);
        out[groupBy] = resolveValue(r, groupBy, field);
      }
      for (const s of cfg.summarize ?? []) {
        if (!(s.field in out)) {
          const field = getField(cfg.objectType, s.field);
          out[s.field] = resolveValue(r, s.field, field);
        }
      }
      for (const pf of postFilters) {
        if (!(pf.field in out)) {
          const field = getField(cfg.objectType, pf.field);
          out[pf.field] = resolveValue(r, pf.field, field);
        }
      }
      return out;
    });

    // Apply post-filters (JSON / computed)
    if (postFilters.length > 0) {
      flatRows = flatRows.filter((row) => postFilters.every((pf) => matchPostFilter(row[pf.field], pf.operator, pf.value)));
    }

    // Columns for UI
    const uiColumns: ReportResultColumn[] = columns.map((c) => ({
      key: c,
      label: meta.fields.find((f) => f.key === c)?.label ?? c,
    }));

    const result: ReportResult = {
      columns: uiColumns,
      rows: flatRows,
      rowCount: flatRows.length,
    };

    // Group / summarize
    const summarize = cfg.summarize ?? [];
    if (groupBy) {
      const groupsMap = new Map<string, Record<string, unknown>[]>();
      for (const r of flatRows) {
        const k = groupKey(r[groupBy]);
        if (!groupsMap.has(k)) groupsMap.set(k, []);
        groupsMap.get(k)!.push(r);
      }
      const groups: ReportResultGroup[] = [];
      for (const [k, rows] of groupsMap.entries()) {
        groups.push({ key: k, rows, summary: computeSummary(rows, summarize) });
      }
      // Sort groups alphabetically by key for deterministic output
      groups.sort((a, b) => a.key.localeCompare(b.key));
      result.groups = groups;
      result.totals = computeSummary(flatRows, summarize);
    } else if (summarize.length > 0) {
      result.totals = computeSummary(flatRows, summarize);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

function matchPostFilter(value: unknown, operator: string, raw: unknown): boolean {
  switch (operator) {
    case "isNull":
      return value === null || value === undefined || value === "";
    case "isNotNull":
      return value !== null && value !== undefined && value !== "";
    case "equals":
      return String(value ?? "") === String(raw ?? "");
    case "not":
      return String(value ?? "") !== String(raw ?? "");
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(raw ?? "").toLowerCase());
    case "startsWith":
      return String(value ?? "").toLowerCase().startsWith(String(raw ?? "").toLowerCase());
    case "endsWith":
      return String(value ?? "").toLowerCase().endsWith(String(raw ?? "").toLowerCase());
    case "gt":
      return Number(value) > Number(raw);
    case "gte":
      return Number(value) >= Number(raw);
    case "lt":
      return Number(value) < Number(raw);
    case "lte":
      return Number(value) <= Number(raw);
    case "in": {
      const arr = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").map((s) => s.trim());
      return arr.includes(String(value ?? ""));
    }
    case "notIn": {
      const arr = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").map((s) => s.trim());
      return !arr.includes(String(value ?? ""));
    }
    default:
      return true;
  }
}
