"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ObjectMetadata, ObjectField } from "@/lib/reports/object-metadata";
import type { ReportFilter, ReportResult, ReportSummarize } from "@/lib/reports/runner";
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@/components/icons/lucide";

interface InitialState {
  id: string | null;
  name: string;
  description: string | null;
  columns: string[];
  filters: ReportFilter[];
  groupBy: string | null;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  summarize: ReportSummarize[];
  rowLimit: number;
}

interface Props {
  objectType: string;
  metadata: ObjectMetadata;
  initial: InitialState;
}

// ── helpers ───────────────────────────────────────────────────────────

const STRING_OPS = [
  { value: "equals", label: "equals" },
  { value: "not", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "in", label: "in (csv)" },
  { value: "notIn", label: "not in (csv)" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];
const NUMBER_OPS = [
  { value: "equals", label: "equals" },
  { value: "not", label: "not equals" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];
const DATE_OPS = [
  { value: "gte", label: "on or after" },
  { value: "lte", label: "on or before" },
  { value: "gt", label: "after" },
  { value: "lt", label: "before" },
  { value: "equals", label: "on" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];
const BOOL_OPS = [
  { value: "equals", label: "equals" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];

function opsForField(field: ObjectField) {
  switch (field.type) {
    case "number":
      return NUMBER_OPS;
    case "date":
      return DATE_OPS;
    case "boolean":
      return BOOL_OPS;
    default:
      return STRING_OPS;
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toLocaleString();
  if (typeof v === "string") {
    // ISO date-time detection
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return v;
  }
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ── component ──────────────────────────────────────────────────────────

export function ReportBuilder({ objectType, metadata, initial }: Props) {
  const router = useRouter();
  const fields = metadata.fields;

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [columns, setColumns] = useState<string[]>(initial.columns);
  const [filters, setFilters] = useState<ReportFilter[]>(initial.filters);
  const [groupBy, setGroupBy] = useState<string | null>(initial.groupBy);
  const [sortBy, setSortBy] = useState<string | null>(initial.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initial.sortDir);
  const [summarize, setSummarize] = useState<ReportSummarize[]>(initial.summarize);
  const [rowLimit, setRowLimit] = useState<number>(initial.rowLimit);

  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fieldByKey = useMemo(() => {
    const m = new Map<string, ObjectField>();
    for (const f of fields) m.set(f.key, f);
    return m;
  }, [fields]);

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q),
    );
  }, [fields, fieldSearch]);

  function toggleColumn(key: string) {
    setColumns((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]));
  }

  function moveColumn(key: string, dir: -1 | 1) {
    setColumns((cur) => {
      const idx = cur.indexOf(key);
      if (idx < 0) return cur;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= cur.length) return cur;
      const next = cur.slice();
      next.splice(idx, 1);
      next.splice(newIdx, 0, key);
      return next;
    });
  }

  function addFilter() {
    const firstField = fields[0];
    if (!firstField) return;
    setFilters((cur) => [...cur, { field: firstField.key, operator: "equals", value: "" }]);
  }

  function updateFilter(i: number, patch: Partial<ReportFilter>) {
    setFilters((cur) => cur.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFilter(i: number) {
    setFilters((cur) => cur.filter((_, idx) => idx !== i));
  }

  function addSummarize() {
    const firstNum = fields.find((f) => f.type === "number");
    if (!firstNum) return;
    setSummarize((cur) => [...cur, { field: firstNum.key, kind: "sum" }]);
  }

  function updateSummarize(i: number, patch: Partial<ReportSummarize>) {
    setSummarize((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSummarize(i: number) {
    setSummarize((cur) => cur.filter((_, idx) => idx !== i));
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/run-adhoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectType,
          columns,
          filters,
          groupBy,
          sortBy,
          sortDir,
          summarize,
          rowLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to run report");
        setResult(null);
      } else {
        setResult(data as ReportResult);
        // Expand all groups on first run
        if (data?.groups) {
          setExpandedGroups(new Set(data.groups.map((g: { key: string }) => g.key)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report");
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        objectType,
        columns,
        filters,
        groupBy,
        sortBy,
        sortDir,
        summarize,
        rowLimit,
      };
      const url = initial.id ? `/api/reports/${initial.id}` : "/api/reports";
      const method = initial.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? "Failed to save report");
      } else {
        if (!initial.id && data?.id) {
          router.push(`/reports/builder?objectType=${objectType}&id=${data.id}`);
        } else {
          router.refresh();
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-[12px] text-[#3052ff] font-semibold"
          >
            <ArrowLeft className="size-3" />
            All Reports
          </Link>
          <div className="text-[11px] text-[#706e6b] uppercase tracking-[0.4px] font-semibold">
            {metadata.pluralLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Play className="size-3" />
            {running ? "Running..." : "Run"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-[#131b2e] bg-white border border-[#e4e6f5] disabled:opacity-50"
          >
            <Save className="size-3" />
            {saving ? "Saving..." : initial.id ? "Save" : "Save report"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[220px_minmax(0,1fr)_280px] gap-4">
        {/* ── Left: Fields panel ────────────────────────────────────── */}
        <aside
          className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)", height: "calc(100vh - 220px)" }}
        >
          <div className="px-4 py-3 border-b border-[#f2f3ff]">
            <div className="text-[13px] font-bold text-[#131b2e]">Fields</div>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-[#706e6b]" />
              <input
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search fields..."
                className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded focus:outline-none focus:border-[#3052ff]"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ height: "calc(100% - 84px)" }}>
            {filteredFields.map((f) => {
              const checked = columns.includes(f.key);
              return (
                <label
                  key={f.key}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#faf8ff] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(f.key)}
                    className="accent-[#3052ff]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#131b2e] truncate">{f.label}</div>
                    <div className="text-[10px] text-[#706e6b] truncate">{f.key}</div>
                  </div>
                </label>
              );
            })}
            {filteredFields.length === 0 && (
              <div className="px-4 py-3 text-[12px] text-[#706e6b]">No matching fields.</div>
            )}
          </div>
        </aside>

        {/* ── Center: Filters + Results ─────────────────────────────── */}
        <main className="space-y-4 min-w-0">
          <section
            className="bg-white rounded-xl p-4"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-bold text-[#131b2e]">Filters</div>
              <button
                onClick={addFilter}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
              >
                <Plus className="size-3" />
                Add Filter
              </button>
            </div>
            {filters.length === 0 ? (
              <div className="text-[12px] text-[#706e6b]">
                No filters. All {metadata.pluralLabel.toLowerCase()} will be returned (up to {rowLimit} rows).
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map((f, i) => {
                  const field = fieldByKey.get(f.field);
                  const ops = field ? opsForField(field) : STRING_OPS;
                  const showValueInput = f.operator !== "isNull" && f.operator !== "isNotNull";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={f.field}
                        onChange={(e) => updateFilter(i, { field: e.target.value })}
                        className="px-2 py-1 text-[12px] border border-[#e4e6f5] rounded bg-white min-w-[160px]"
                      >
                        {fields.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={f.operator}
                        onChange={(e) => updateFilter(i, { operator: e.target.value })}
                        className="px-2 py-1 text-[12px] border border-[#e4e6f5] rounded bg-white min-w-[120px]"
                      >
                        {ops.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {showValueInput && (
                        <input
                          type={field?.type === "date" ? "date" : field?.type === "number" ? "number" : "text"}
                          value={typeof f.value === "string" || typeof f.value === "number" ? String(f.value) : ""}
                          onChange={(e) => updateFilter(i, { value: e.target.value })}
                          className="flex-1 px-2 py-1 text-[12px] border border-[#e4e6f5] rounded"
                          placeholder="Value"
                        />
                      )}
                      <button
                        onClick={() => removeFilter(i)}
                        className="size-7 inline-flex items-center justify-center rounded text-[#942b00] hover:bg-[#fff2ef]"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="px-4 py-3 border-b border-[#f2f3ff] flex items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-[#131b2e]">Preview</div>
                {result && (
                  <div className="text-[11px] text-[#706e6b]">
                    {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
                    {result.groups ? ` in ${result.groups.length} group${result.groups.length === 1 ? "" : "s"}` : ""}
                  </div>
                )}
              </div>
              {result?.totals && summarize.length > 0 && !result.groups && (
                <div className="flex items-center gap-3 text-[12px] text-[#131b2e]">
                  {summarize.map((s) => {
                    const key = `${s.field}_${s.kind}`;
                    const val = (result.totals as Record<string, unknown>)[key];
                    const label = fieldByKey.get(s.field)?.label ?? s.field;
                    return (
                      <div key={key}>
                        <span className="text-[#706e6b]">{label} {s.kind}</span>{" "}
                        <span className="font-bold">{formatCell(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-3 text-[12px] text-[#942b00] bg-[#fff2ef]">
                Error: {error}
              </div>
            )}

            {!result && !error && (
              <div className="px-4 py-10 text-center text-[12px] text-[#706e6b]">
                Click Run to see results.
              </div>
            )}

            {result && (
              <div className="overflow-x-auto" style={{ maxHeight: "calc(100vh - 480px)" }}>
                {result.groups ? (
                  <div>
                    {result.groups.map((g) => {
                      const expanded = expandedGroups.has(g.key);
                      return (
                        <div key={g.key} className="border-b border-[#f2f3ff] last:border-b-0">
                          <button
                            onClick={() =>
                              setExpandedGroups((cur) => {
                                const next = new Set(cur);
                                if (next.has(g.key)) next.delete(g.key);
                                else next.add(g.key);
                                return next;
                              })
                            }
                            className="w-full flex items-center justify-between px-4 py-2 bg-[#fafaff] hover:bg-[#f2f3ff] text-left"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`size-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
                              />
                              <span className="text-[12px] font-bold text-[#131b2e]">{g.key}</span>
                              <span className="text-[11px] text-[#706e6b]">
                                ({(g.summary as Record<string, unknown>)._count as number} rows)
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#131b2e]">
                              {summarize.map((s) => {
                                const key = `${s.field}_${s.kind}`;
                                const val = (g.summary as Record<string, unknown>)[key];
                                const label = fieldByKey.get(s.field)?.label ?? s.field;
                                return (
                                  <div key={key}>
                                    <span className="text-[#706e6b]">
                                      {label} {s.kind}:
                                    </span>{" "}
                                    <span className="font-bold">{formatCell(val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </button>
                          {expanded && (
                            <ResultsTable
                              columns={result.columns}
                              rows={g.rows.slice(0, 50)}
                              onSort={(key) => {
                                if (sortBy === key) {
                                  setSortDir(sortDir === "asc" ? "desc" : "asc");
                                } else {
                                  setSortBy(key);
                                  setSortDir("asc");
                                }
                              }}
                              sortBy={sortBy}
                              sortDir={sortDir}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ResultsTable
                    columns={result.columns}
                    rows={result.rows.slice(0, 50)}
                    onSort={(key) => {
                      if (sortBy === key) {
                        setSortDir(sortDir === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy(key);
                        setSortDir("asc");
                      }
                    }}
                    sortBy={sortBy}
                    sortDir={sortDir}
                  />
                )}
              </div>
            )}
          </section>
        </main>

        {/* ── Right: Settings ─────────────────────────────────────── */}
        <aside
          className="bg-white rounded-xl p-4 space-y-4 self-start"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1">
              Report Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 text-[13px] border border-[#e4e6f5] rounded"
              placeholder="e.g. Open Opps by Owner"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded resize-none"
              rows={2}
              placeholder="Optional"
            />
          </div>

          <div className="border-t border-[#f2f3ff] pt-3">
            <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-2">
              Columns ({columns.length})
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {columns.map((key, i) => {
                const f = fieldByKey.get(key);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1 text-[12px] px-2 py-1 bg-[#fafaff] rounded"
                  >
                    <span className="flex-1 truncate text-[#131b2e] font-semibold">{f?.label ?? key}</span>
                    <button
                      onClick={() => moveColumn(key, -1)}
                      disabled={i === 0}
                      className="size-5 inline-flex items-center justify-center rounded text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-30"
                    >
                      <ChevronUpIcon className="size-3" />
                    </button>
                    <button
                      onClick={() => moveColumn(key, 1)}
                      disabled={i === columns.length - 1}
                      className="size-5 inline-flex items-center justify-center rounded text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-30"
                    >
                      <ChevronDownIcon className="size-3" />
                    </button>
                    <button
                      onClick={() => toggleColumn(key)}
                      className="size-5 inline-flex items-center justify-center rounded text-[#942b00] hover:bg-[#fff2ef]"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#f2f3ff] pt-3">
            <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1">
              Group By
            </label>
            <select
              value={groupBy ?? ""}
              onChange={(e) => setGroupBy(e.target.value || null)}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded bg-white"
            >
              <option value="">No grouping</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1">
              Sort By
            </label>
            <div className="flex gap-1">
              <select
                value={sortBy ?? ""}
                onChange={(e) => setSortBy(e.target.value || null)}
                className="flex-1 px-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded bg-white"
              >
                <option value="">Default (created desc)</option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                className="px-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded bg-white"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>

          <div className="border-t border-[#f2f3ff] pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px]">
                Summarize ({summarize.length})
              </div>
              <button
                onClick={addSummarize}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
              >
                <Plus className="size-3" />
                Add
              </button>
            </div>
            {summarize.length === 0 ? (
              <div className="text-[11px] text-[#706e6b]">None</div>
            ) : (
              <div className="space-y-2">
                {summarize.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select
                      value={s.field}
                      onChange={(e) => updateSummarize(i, { field: e.target.value })}
                      className="flex-1 px-1.5 py-1 text-[11px] border border-[#e4e6f5] rounded bg-white"
                    >
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.kind}
                      onChange={(e) => updateSummarize(i, { kind: e.target.value as ReportSummarize["kind"] })}
                      className="px-1.5 py-1 text-[11px] border border-[#e4e6f5] rounded bg-white"
                    >
                      <option value="count">count</option>
                      <option value="sum">sum</option>
                      <option value="avg">avg</option>
                    </select>
                    <button
                      onClick={() => removeSummarize(i)}
                      className="size-5 inline-flex items-center justify-center rounded text-[#942b00] hover:bg-[#fff2ef]"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#f2f3ff] pt-3">
            <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1">
              Row Limit
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={rowLimit}
              onChange={(e) => setRowLimit(Math.max(1, Math.min(10000, Number(e.target.value) || 0)))}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e4e6f5] rounded"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Results table ─────────────────────────────────────────────────────

interface ResultsTableProps {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  onSort?: (key: string) => void;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
}

export function ResultsTable({ columns, rows, onSort, sortBy, sortDir }: ResultsTableProps) {
  return (
    <table className="w-full text-[12px]">
      <thead className="bg-[#fafaff] sticky top-0">
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              onClick={onSort ? () => onSort(c.key) : undefined}
              className={`text-left px-3 py-2 text-[10px] uppercase tracking-[0.4px] font-semibold text-[#444656] border-b border-[#f2f3ff] ${
                onSort ? "cursor-pointer hover:text-[#3052ff]" : ""
              }`}
            >
              {c.label}
              {sortBy === c.key && (
                <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-3 py-6 text-center text-[12px] text-[#706e6b]">
              No rows.
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-[#131b2e]">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
