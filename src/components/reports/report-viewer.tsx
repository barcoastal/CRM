"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReportResult, ReportFilter, ReportSummarize } from "@/lib/reports/runner";

/**
 * SF report run page, 1:1: header (Report: <Object> / name + Edit/refresh/
 * filter buttons), metrics strip (Total Records + summarized measures), a
 * horizontal bar chart over the first grouping, the grouped grid with
 * subtotals and grand total, and the SF footer toggles (Row Counts, Detail
 * Rows, Subtotals, Grand Total).
 */
interface Props {
  id: string;
  name: string;
  description: string | null;
  objectType: string;
  objectLabel: string;
  ownerName: string | null;
  summarize: ReportSummarize[];
  groupBy: string | null;
  filterCount: number;
  filters?: ReportFilter[];
}

const usd = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "-");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export function ReportViewer({ id, name, objectLabel, summarize, groupBy, filterCount }: Props) {
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // SF footer toggles
  const [showRowCounts, setShowRowCounts] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [showSubtotals, setShowSubtotals] = useState(true);
  const [showGrandTotal, setShowGrandTotal] = useState(true);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Failed to run report"); setResult(null); }
      else setResult(data as ReportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run report");
    } finally {
      setRunning(false);
    }
  }
  useEffect(() => { void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Chart data: per-group first summarized metric, else row count.
  const chart = useMemo(() => {
    if (!result?.groups?.length) return null;
    const metric = summarize[0];
    const bars = result.groups.map((g) => ({
      label: g.key || "(blank)",
      value: metric ? Number(g.summary[`${metric.kind}:${metric.field}`] ?? g.rows.length) : g.rows.length,
    }));
    const max = Math.max(...bars.map((b) => b.value), 1);
    return { bars: bars.slice(0, 25), max };
  }, [result, summarize]);

  const metricCards = useMemo(() => {
    const cards: Array<{ label: string; value: string }> = [
      { label: "Total Records", value: (result?.rowCount ?? 0).toLocaleString() },
    ];
    if (result?.totals) {
      for (const s of summarize) {
        const key = `${s.kind}:${s.field}`;
        if (result.totals[key] != null) {
          cards.push({ label: `${s.kind === "sum" ? "Total" : s.kind === "avg" ? "Average" : "Count of"} ${s.field.split(".").pop()?.replace(/([A-Z])/g, " $1")}`, value: usd(result.totals[key]) });
        }
      }
    }
    return cards;
  }, [result, summarize]);

  const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#444444", borderBottom: "1px solid #c9c9c9", whiteSpace: "nowrap", background: "#fafaf9", position: "sticky", top: 0 };
  const td: React.CSSProperties = { padding: "6px 10px", fontSize: 12.5, color: "#181818", borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" };

  const columns = result?.columns ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 6, background: "#2e844a" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M5 9h3v10H5zM10.5 5h3v14h-3zM16 12h3v7h-3z" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#444444" }}>Report: {objectLabel}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#181818", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        </div>
        <Link href="/reports" className="slds-button slds-button_neutral">All Reports</Link>
        <button className="slds-button slds-button_neutral" title={`${filterCount} filters`} style={{ cursor: "default" }}>
          ▼ {filterCount}
        </button>
        <button className="slds-button slds-button_neutral" onClick={() => void run()} style={{ cursor: "pointer" }}>↻</button>
        <Link href={`/reports/builder?id=${id}`} className="slds-button slds-button_brand">Edit</Link>
      </div>

      {/* Metrics strip */}
      <div style={{ display: "flex", gap: 32, padding: "10px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff" }}>
        {metricCards.map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 12, color: "#444444" }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#181818" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {running && <div style={{ padding: 48, textAlign: "center", color: "#747474" }}>Running report...</div>}
      {error && <div style={{ padding: 24, color: "#c23934" }}>{error}</div>}

      {!running && !error && result && (
        <>
          {/* Bar chart over the first grouping (SF Add Chart look) */}
          {chart && (
            <div style={{ padding: "14px 24px", borderBottom: "1px solid #e5e5e5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#444444", marginBottom: 8, textAlign: "center" }}>
                {summarize[0] ? "Sum" : "Record Count"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", rowGap: 4, alignItems: "center", maxHeight: 420, overflowY: "auto" }}>
                {chart.bars.map((b) => (
                  <>
                    <div key={`${b.label}-l`} style={{ fontSize: 11, color: "#444444", textAlign: "right", paddingRight: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</div>
                    <div key={`${b.label}-b`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ height: 14, width: `${Math.max(1, (b.value / chart.max) * 100)}%`, background: "#1b96ff", borderRadius: 2 }} />
                    </div>
                  </>
                ))}
              </div>
            </div>
          )}

          {/* Grid */}
          <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {groupBy && <th style={th}>{groupBy.split(".").pop()?.replace(/([A-Z])/g, " $1")} ↑</th>}
                  {columns.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.groups?.length ? (
                  result.groups.map((g) => (
                    <GroupRows
                      key={g.key}
                      group={g}
                      columns={columns}
                      td={td}
                      showDetails={showDetails}
                      showRowCounts={showRowCounts}
                      showSubtotals={showSubtotals}
                      summarize={summarize}
                    />
                  ))
                ) : (
                  result.rows.map((row, i) => (
                    <tr key={i}>
                      {groupBy && <td style={td}></td>}
                      {columns.map((c) => <td key={c.key} style={td}>{String(row[c.key] ?? "-")}</td>)}
                    </tr>
                  ))
                )}
                {showGrandTotal && result.totals && (
                  <tr style={{ background: "#f3f3f3", fontWeight: 700 }}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      Grand Total{showRowCounts ? ` (${result.rowCount.toLocaleString()} records)` : ""}
                    </td>
                    {(groupBy ? columns : columns.slice(1)).map((c) => (
                      <td key={c.key} style={{ ...td, fontWeight: 700 }}>
                        {summarize.filter((s) => s.field === c.key).map((s) => usd(result.totals?.[`${s.kind}:${s.field}`])).join(" ") || ""}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SF footer toggles */}
          <div style={{ display: "flex", gap: 24, alignItems: "center", padding: "8px 16px", borderTop: "1px solid #e5e5e5", background: "#fafaf9" }}>
            <Toggle label="Row Counts" on={showRowCounts} set={setShowRowCounts} />
            <Toggle label="Detail Rows" on={showDetails} set={setShowDetails} />
            <Toggle label="Subtotals" on={showSubtotals} set={setShowSubtotals} />
            <Toggle label="Grand Total" on={showGrandTotal} set={setShowGrandTotal} />
          </div>
        </>
      )}
    </div>
  );
}

function GroupRows({ group, columns, td, showDetails, showRowCounts, showSubtotals, summarize }: {
  group: NonNullable<ReportResult["groups"]>[number];
  columns: ReportResult["columns"];
  td: React.CSSProperties;
  showDetails: boolean;
  showRowCounts: boolean;
  showSubtotals: boolean;
  summarize: ReportSummarize[];
}) {
  return (
    <>
      <tr style={{ background: "#f3f6fb" }}>
        <td style={{ ...td, fontWeight: 700 }} colSpan={1}>
          {group.key || "(blank)"}{showRowCounts ? ` (${group.rows.length.toLocaleString()})` : ""}
        </td>
        {columns.map((c) => (
          <td key={c.key} style={{ ...td, fontWeight: 700 }}>
            {showSubtotals
              ? summarize.filter((s) => s.field === c.key).map((s) => {
                  const v = group.summary[`${s.kind}:${s.field}`];
                  return v != null ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";
                }).join(" ")
              : ""}
          </td>
        ))}
      </tr>
      {showDetails && group.rows.map((row, i) => (
        <tr key={i}>
          <td style={td}></td>
          {columns.map((c) => <td key={c.key} style={td}>{String(row[c.key] ?? "-")}</td>)}
        </tr>
      ))}
    </>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#444444", cursor: "pointer" }}>
      {label}
      <span
        onClick={() => set(!on)}
        style={{
          display: "inline-flex", alignItems: "center", width: 36, height: 18, borderRadius: 9,
          background: on ? "#0176d3" : "#c9c9c9", position: "relative", transition: "background .15s",
        }}
      >
        <span style={{ position: "absolute", left: on ? 19 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
        {on && <span style={{ position: "absolute", left: 5, color: "#fff", fontSize: 9, fontWeight: 700 }}>✓</span>}
      </span>
    </label>
  );
}
