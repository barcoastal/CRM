import type { Prisma } from "@/generated/prisma/client";
import { reportPrefilter } from "./prefilter";
import { createHash } from "node:crypto";
import { validateFormulas, evaluateFormula, formulaDependencies, type ReportFormula } from "./formulas";
import { reportOptionsSchema, groupingValue, type ReportOptions } from "./advanced";
import { runtimeWhere, type RuntimeFilters } from "./runtime-filters";
import { analyticsAccess, analyticsScope, redactAnalyticsRelations, type AnalyticsAccess } from "@/lib/analytics-access";
import { prisma } from "@/lib/prisma";
import { getObjectMetadata, type ObjectField } from "./object-metadata";
import { accountRelatedTotals } from "./related";

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
  formulas?: ReportFormula[];
  options?: ReportOptions;
  runtimeFilters?: RuntimeFilters;
  groupBy?: string | null;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  summarize?: ReportSummarize[];
  rowLimit?: number;
}

export interface ReportResultGroup {
  key: string;
  id?: string;
  path?: string[];
  count?: number;
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
  displayedRowCount?: number;
  summaryFormulas?: { key: string; label: string }[];
  generatedAt?: string;
  scopeHash?: string;
  groupSubtotals?: {path:string[];count:number;summary:Record<string,unknown>}[];
  truncated?: boolean;
  warning?: string;
}

export type ReportRunOutcome = ReportResult | { error: string };


const PAGE_SIZE = 1000;
const MAX_GROUPS = 20000;
const OPERATORS = new Set(["equals", "not", "contains", "startsWith", "endsWith", "gt", "gte", "lt", "lte", "in", "notIn", "isNull", "isNotNull"]);
function pathValue(obj: unknown, key: string): unknown {
  let value = obj;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  return value ?? null;
}
function resolveValue(row: Record<string, unknown>, field: ObjectField): unknown {
  if (field.source === "json" && field.jsonColumn) {
    let source = row[field.jsonColumn];
    if (typeof source === "string") { try { source = JSON.parse(source); } catch { return null; } }
    return pathValue(source, field.key.slice(field.jsonColumn.length + 1));
  }
  return pathValue(row, field.key);
}
type Selection = { [key: string]: true | { select: Selection } };
function selectPath(selection: Selection, key: string) {
  const parts = key.split("."); let node = selection;
  for (const part of parts.slice(0, -1)) {
    if (!node[part] || node[part] === true) node[part] = { select: { id: true } };
    node = (node[part] as { select: Selection }).select;
  }
  node[parts[parts.length - 1]] = true;
}
async function redactTree(rows: Record<string, unknown>[], selection: Selection, access: AnalyticsAccess, db: Prisma.TransactionClient): Promise<Record<string, unknown>[]> {
  const relations = Object.keys(selection).filter(k => selection[k] !== true);
  const safe = await redactAnalyticsRelations(rows, relations, access, db);
  for (const key of relations) {
    const childRows = safe.flatMap(r => r[key] ? [r[key] as Record<string, unknown>] : []);
    if (!childRows.length) continue;
    const children = await redactTree(childRows, (selection[key] as { select: Selection }).select, access, db);
    let index = 0;
    for (const row of safe) if (row[key]) row[key] = children[index++];
  }
  return safe;
}
function matchesFilters(row: Record<string, unknown>, filters: ReportFilter[], fields: Map<string, ObjectField>) {
  const groups = new Map<string, boolean>();
  for (const filter of filters) {
    const field = fields.get(filter.field)!;
    let value = row[filter.field], raw = filter.value;
    if (field.type === "date" && value != null && raw != null && !filter.operator.startsWith("is")) {
      value = new Date(String(value)).getTime(); raw = new Date(String(raw)).getTime();
    }
    if (field.type === "number" && raw !== null && raw !== "" && !["in", "notIn"].includes(filter.operator)) raw = Number(raw);
    if (field.type === "boolean" && typeof raw === "string") raw = raw === "true" ? true : raw === "false" ? false : raw;
    const match = matchPostFilter(value, filter.operator, raw);
    if (!filter.orGroup && !match) return false;
    if (filter.orGroup) groups.set(filter.orGroup, (groups.get(filter.orGroup) ?? true) && match);
  }
  return !groups.size || [...groups.values()].some(Boolean);
}
type Accumulator = { count: number; values: Map<string, { sum: number; count: number; present: number }> };
function accumulator(): Accumulator { return { count: 0, values: new Map() }; }
function accumulate(acc: Accumulator, row: Record<string, unknown>, measures: ReportSummarize[]) {
  acc.count++;
  for (const field of new Set(measures.map(m => m.field))) {
    const state = acc.values.get(field) ?? { sum: 0, count: 0, present: 0 };
    const value = row[field];
    if (value != null) state.present++;
    if (value != null && value !== "" && Number.isFinite(Number(value))) { state.sum += Number(value); state.count++; }
    acc.values.set(field, state);
  }
}
function finish(acc: Accumulator, measures: ReportSummarize[], formulas: ReportFormula[], now: Date) {
  const totals: Record<string, unknown> = { _count: acc.count };
  for (const measure of measures) {
    const v = acc.values.get(measure.field) ?? { sum: 0, count: 0, present: 0 };
    totals[`${measure.field}_${measure.kind}`] = measure.kind === "count" ? v.present : measure.kind === "sum" ? v.sum : v.count ? v.sum / v.count : null;
  }
  for (const f of formulas) totals[f.key] = evaluateFormula(f, totals, now);
  return totals;
}

export async function runReport(cfg: ReportConfig): Promise<ReportRunOutcome> {
  return runReportWithAccess(cfg, await analyticsAccess("Reports.View"));
}
/** Server-only explicit access entry point for scheduled snapshots. Never accept access from request JSON. */
export async function runReportWithAccess(cfg: ReportConfig, access: AnalyticsAccess, db?: Prisma.TransactionClient): Promise<ReportRunOutcome> {
  try {
    if (!db) return await prisma.$transaction(tx => runReportWithAccess(cfg, access, tx), { isolationLevel: "RepeatableRead", timeout: 120000, maxWait: 10000 });
    const now = new Date();
    const scopeHash = createHash("sha256");
    scopeHash.update(JSON.stringify([access.userId, access.isAdmin, [...access.permissions].sort(), [...access.ownerIds].sort()]));
    const meta = getObjectMetadata(cfg.objectType);
    if (!meta) throw new Error(`Unknown report type: ${cfg.objectType}`);
    const fields = new Map(meta.fields.map(f => [f.key, f]));
    const formulas = validateFormulas(cfg.formulas, cfg.objectType);
    const rowFormulas = formulas.filter(f => f.scope !== "summary"), summaryFormulas = formulas.filter(f => f.scope === "summary");
    const columns = (cfg.columns ?? []).filter(key => fields.has(key));
    if (!columns.length) columns.push(...meta.defaultColumns);
    const filters = cfg.filters ?? [];
    for (const f of filters) if (!f || !fields.has(f.field) || !OPERATORS.has(f.operator)) throw new Error(`Unsupported report filter: ${f?.field ?? "unknown"}. Update the report filters before running.`);
    const options = reportOptionsSchema.parse(cfg.options ?? {});
    const groupings = options.groups.length ? options.groups : cfg.groupBy ? [{ field: cfg.groupBy, interval: "value" as const }] : [];
    for (const g of groupings) if (!fields.has(g.field) || (g.interval !== "value" && fields.get(g.field)?.type !== "date")) throw new Error("Choose valid grouping fields and date intervals");
    const measures = [...(cfg.summarize ?? [])];
    for (const f of summaryFormulas) for (const key of formulaDependencies(f)) {
      if (key === "_count") continue;
      const match = key.match(/^(.*)_(sum|avg|count)$/)!;
      if (!measures.some(m => m.field === match[1] && m.kind === match[2])) measures.push({ field: match[1], kind: match[2] as ReportSummarize["kind"] });
    }
    for (const m of measures) if ((!fields.has(m.field) && !rowFormulas.some(f => f.key === m.field)) || !["sum", "avg", "count"].includes(m.kind)) throw new Error("Unsupported summary field");
    const requestedSort = cfg.sortBy ?? (fields.has("createdAt") ? "createdAt" : fields.has("capturedAt") ? "capturedAt" : fields.has("changedAt") ? "changedAt" : null);
    const dependencies = new Set([...columns, ...filters.map(f => f.field), ...groupings.map(g => g.field), ...measures.map(m => m.field), ...rowFormulas.flatMap(formulaDependencies), ...(requestedSort ? [requestedSort] : [])]);
    const select: Selection = { id: true };
    for (const key of dependencies) {
      const field = fields.get(key); if (!field || field.source === "computed") continue;
      selectPath(select, field.source === "json" ? field.jsonColumn! : field.key);
    }
    const delegate = (db as unknown as Record<string, { findMany(args: unknown): Promise<Record<string, unknown>[]> }>)[meta.prismaModel];
    if (!delegate) throw new Error("Report data source is unavailable");
    const where = { AND: [analyticsScope(access, meta.prismaModel), await runtimeWhere(meta.prismaModel, cfg.runtimeFilters), reportPrefilter(filters, fields)] };
    const limit = Math.min(10000, Math.max(1, Math.floor(cfg.rowLimit ?? 2000)));
    if (!Number.isFinite(limit)) throw new Error("Invalid detail row limit");
    const rows: Record<string, unknown>[] = [], totals = accumulator();
    const groups = new Map<string, { key: string; path: string[]; acc: Accumulator }>();
    const parentGroups = new Map<string, {path:string[];acc:Accumulator}>();
    const rowPaths = new Map<Record<string, unknown>, string>();
    const sortKey = requestedSort && (fields.has(requestedSort) || rowFormulas.some(f => f.key === requestedSort)) ? requestedSort : null;
    const compare = (a: Record<string, unknown>, b: Record<string, unknown>) => (compareValues(a[sortKey!], b[sortKey!]) ?? 0) * ((!cfg.sortBy || cfg.sortDir === "desc") ? -1 : 1);
    let cursor: string | undefined;
    while (true) {
      if (Date.now() - now.getTime() > 110000) throw new Error("This report needs narrower filters to complete. No partial totals were returned.");
      const raw = await delegate.findMany({ where, select, orderBy: { id: "asc" }, take: PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!raw.length) break;
      const lastId = String(raw[raw.length - 1].id);
      if (cursor === lastId) throw new Error("Report pagination did not advance");
      const page = await redactTree(raw, select, access, db);
      if (meta.prismaModel === "account" && [...dependencies].some(k => k.startsWith("related."))) {
        const related = await accountRelatedTotals(page.map(r => String(r.id)), access, db);
        for (const r of page) r.related = related.get(String(r.id));
      }
      for (const r of page) {
        const row: Record<string, unknown> = {};
        for (const key of dependencies) { const field = fields.get(key); if (field) row[key] = resolveValue(r, field); }
        if (!matchesFilters(row, filters, fields)) continue;
        for (const f of rowFormulas) row[f.key] = evaluateFormula(f, row, now);
        const paths: Record<string, string> = { Lead: "leads", Opportunity: "opportunities", Account: "accounts", Case: "cases" };
        if (paths[cfg.objectType]) row._recordUrl = `/${paths[cfg.objectType]}/${encodeURIComponent(String(r.id))}`;
        const identity = (obj: Record<string, unknown>, tree: Selection): unknown[] => [obj.id, ...Object.entries(tree).filter(([,v]) => v !== true).map(([key,v]) => obj[key] ? identity(obj[key] as Record<string, unknown>, (v as {select:Selection}).select) : null)];
        scopeHash.update(JSON.stringify(identity(r, select)));
        if (r.related) scopeHash.update(String((r.related as Record<string, unknown>)._scopeHash ?? ""));
        accumulate(totals, row, measures);
        const path = groupings.map(g => groupingValue(row[g.field], g.interval));
        if (path.length) {
          const key = JSON.stringify(path);
          let group = groups.get(key);
          if (!group) { if (groups.size >= MAX_GROUPS) throw new Error("Too many groups. Narrow filters or use a broader date interval."); group = { key, path, acc: accumulator() }; groups.set(key, group); }
          accumulate(group.acc, row, measures); rowPaths.set(row, key);
          for (let level=1; level<path.length; level++) {const prefix=path.slice(0,level), parentKey=JSON.stringify(prefix);let parent=parentGroups.get(parentKey);if(!parent){parent={path:prefix,acc:accumulator()};parentGroups.set(parentKey,parent);}accumulate(parent.acc,row,measures);}
        }
        if (!sortKey) { if (rows.length < limit) rows.push(row); else rowPaths.delete(row); }
        else {
          // Keep only the best N detail rows; totals still accumulate every match.
          if (rows.length < limit || compare(row, rows[rows.length - 1]) < 0) {
            let lo = 0, hi = rows.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (compare(rows[mid], row) <= 0) lo = mid + 1; else hi = mid; }
            rows.splice(lo, 0, row); if (rows.length > limit) rowPaths.delete(rows.pop()!);
          } else rowPaths.delete(row);
        }
      }
      cursor = lastId;
      if (raw.length < PAGE_SIZE) break;
    }
    const result: ReportResult = { columns: [...columns.map(key => ({ key, label: fields.get(key)!.label })), ...rowFormulas.map(f => ({ key: f.key, label: f.label }))], rows, rowCount: totals.count, displayedRowCount: rows.length, totals: finish(totals, measures, summaryFormulas, now), summaryFormulas: summaryFormulas.map(f => ({ key: f.key, label: f.label })), generatedAt: now.toISOString(), scopeHash: scopeHash.digest("hex"), truncated: totals.count > rows.length };
    if (result.truncated) result.warning = `Showing ${rows.length.toLocaleString()} of ${totals.count.toLocaleString()} matching records. Counts, charts, group summaries and totals include all matches. Detail exports contain only displayed rows.`;
    if (groupings.length) result.groups = [...groups.values()].sort((a,b) => a.path.join(" / ").localeCompare(b.path.join(" / "))).map(g => ({ id: g.key, key: g.path.join(" → "), path: g.path, count: g.acc.count, rows: rows.filter(row => rowPaths.get(row) === g.key), summary: finish(g.acc, measures, summaryFormulas, now) }));
    if (parentGroups.size) result.groupSubtotals=[...parentGroups.values()].sort((a,b)=>a.path.join(" / ").localeCompare(b.path.join(" / "))).map(g=>({path:g.path,count:g.acc.count,summary:finish(g.acc,measures,summaryFormulas,now)}));
    return result;
  } catch (error) { return { error: error instanceof Error ? error.message : "Report failed" }; }
}

function compareValues(a: unknown, b: unknown): number | null {
  const na = Number(a);
  const nb = Number(b);
  const aNum = typeof a !== "boolean" && String(a).trim() !== "" && Number.isFinite(na);
  const bNum = typeof b !== "boolean" && String(b).trim() !== "" && Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  const da = Date.parse(String(a));
  const db = Date.parse(String(b));
  if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  return sa < sb ? -1 : sa > sb ? 1 : 0;
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
    case "gte":
    case "lt":
    case "lte": {
      if (value === null || value === undefined || value === "") return false;
      const c = compareValues(value, raw);
      if (c === null) return false;
      return operator === "gt" ? c > 0 : operator === "gte" ? c >= 0 : operator === "lt" ? c < 0 : c <= 0;
    }
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
