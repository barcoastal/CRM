"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Report definitions ──────────────────────────────────────────────
// Each "pre-built" report maps to one of the manager dashboard buckets so we
// can render real numbers without inventing yet another aggregate API.

export type ReportKey =
  | "leads-by-status"
  | "leads-bar"
  | "opps-by-stage"
  | "opps-bar"
  | "lead-dispo-day"
  | "opp-dispo-day"
  | "lead-conversion-rate"
  | "opp-win-rate"
  | "pipeline-by-stage"
  | "aging-opps";

export const REPORT_LIBRARY: {
  key: ReportKey;
  name: string;
  folder: string;
  description: string;
  visual: "donut" | "bar" | "table" | "kpi";
  entity: "Lead" | "Opportunity";
}[] = [
  {
    key: "leads-by-status",
    name: "Leads by Status",
    folder: "Leads",
    description: "Donut breakdown of every lead by current status.",
    visual: "donut",
    entity: "Lead",
  },
  {
    key: "leads-bar",
    name: "Leads Report",
    folder: "Leads",
    description: "Record count and total enrolled debt grouped by status.",
    visual: "bar",
    entity: "Lead",
  },
  {
    key: "lead-dispo-day",
    name: "Lead Disposition by Day",
    folder: "Leads",
    description: "Matrix of created date × lead status with subtotals.",
    visual: "table",
    entity: "Lead",
  },
  {
    key: "lead-conversion-rate",
    name: "Lead Conversion Rate",
    folder: "Leads",
    description: "Converted vs total leads in the selected range.",
    visual: "kpi",
    entity: "Lead",
  },
  {
    key: "opps-by-stage",
    name: "Opportunities by Stage",
    folder: "Opportunities",
    description: "Donut of all opportunities by pipeline stage.",
    visual: "donut",
    entity: "Opportunity",
  },
  {
    key: "opps-bar",
    name: "Opportunities Report",
    folder: "Opportunities",
    description: "Record count and amount grouped by stage.",
    visual: "bar",
    entity: "Opportunity",
  },
  {
    key: "opp-dispo-day",
    name: "Opportunities Disposition by Day",
    folder: "Opportunities",
    description: "Matrix of created date × stage with subtotals.",
    visual: "table",
    entity: "Opportunity",
  },
  {
    key: "opp-win-rate",
    name: "Opportunity Win Rate",
    folder: "Opportunities",
    description: "Closed Won vs Closed Lost in the selected range.",
    visual: "kpi",
    entity: "Opportunity",
  },
  {
    key: "pipeline-by-stage",
    name: "Pipeline by Stage",
    folder: "Opportunities",
    description: "Total open pipeline value per stage.",
    visual: "bar",
    entity: "Opportunity",
  },
  {
    key: "aging-opps",
    name: "Aging Opportunities",
    folder: "Opportunities",
    description: "Top opportunities by days since last activity.",
    visual: "table",
    entity: "Opportunity",
  },
];

const COLORS = [
  "#1589ee",
  "#0070d2",
  "#16325c",
  "#c23934",
  "#ffb75d",
  "#04844b",
  "#706e6b",
  "#5867e8",
  "#dd7a01",
  "#54698d",
];

interface ManagerData {
  leadsByStatus: { label: string; count: number }[];
  oppsByStage: { label: string; count: number }[];
  leadsBar: { label: string; count: number; amount: number }[];
  oppsBar: { label: string; count: number; amount: number }[];
  leadsDispo: { day: string; status: string; count: number; isSubtotal: boolean }[];
  oppsDispo: { day: string; status: string; count: number; isSubtotal: boolean }[];
  totals: { totalLeads: number; totalOpps: number };
  keyDeals: { name: string | null; stage: string; amount: number | null; updatedAt: string }[];
}

const PRESETS = [
  { label: "All Time", preset: "all" },
  { label: "This Week", preset: "wtd" },
  { label: "This Month", preset: "mtd" },
  { label: "This Quarter", preset: "qtd" },
  { label: "This Year", preset: "ytd" },
  { label: "Last 30 Days", preset: "last30" },
  { label: "Last 90 Days", preset: "last90" },
];

function presetParams(preset: string): URLSearchParams {
  const p = new URLSearchParams();
  if (preset === "all") return p;
  const now = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  let from: Date | null = null;
  switch (preset) {
    case "wtd": {
      const dow = now.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      from = new Date(now);
      from.setDate(now.getDate() - diff);
      break;
    }
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
      break;
    }
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "last30": {
      from = new Date(now);
      from.setDate(now.getDate() - 30);
      break;
    }
    case "last90": {
      from = new Date(now);
      from.setDate(now.getDate() - 90);
      break;
    }
  }
  if (from) {
    p.set("createFrom", ymd(from));
    p.set("createTo", ymd(now));
  }
  return p;
}

export function ReportBuilder({ initialReport }: { initialReport?: ReportKey }) {
  const [active, setActive] = useState<ReportKey>(initialReport ?? "leads-by-status");
  const [preset, setPreset] = useState("all");
  const [groupBy, setGroupBy] = useState("status");
  const [visual, setVisual] = useState<"donut" | "bar" | "table" | "kpi">("donut");
  const [data, setData] = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);

  const report = useMemo(
    () => REPORT_LIBRARY.find((r) => r.key === active) ?? REPORT_LIBRARY[0],
    [active],
  );

  useEffect(() => {
    setVisual(report.visual);
    setGroupBy(report.entity === "Lead" ? "status" : "stage");
  }, [report]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = presetParams(preset);
      const res = await fetch(`/api/dashboard/manager?${params.toString()}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as ManagerData);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const { chartData, tableRows, kpi } = useMemo(() => {
    if (!data) return { chartData: [], tableRows: [], kpi: null as null | { label: string; value: string; sub: string } };
    switch (active) {
      case "leads-by-status":
      case "lead-conversion-rate": {
        const rows = data.leadsByStatus;
        const total = rows.reduce((s, r) => s + r.count, 0);
        const converted =
          rows.find((r) => /CONVERTED|ENROLLED/i.test(r.label))?.count ?? 0;
        return {
          chartData: rows,
          tableRows: rows.map((r) => ({
            group: r.label,
            count: r.count,
            secondary: total > 0 ? `${((r.count / total) * 100).toFixed(1)}%` : "—",
          })),
          kpi:
            active === "lead-conversion-rate"
              ? {
                  label: "Lead Conversion Rate",
                  value: total > 0 ? `${((converted / total) * 100).toFixed(1)}%` : "0%",
                  sub: `${converted.toLocaleString()} converted / ${total.toLocaleString()} total`,
                }
              : null,
        };
      }
      case "leads-bar":
        return {
          chartData: data.leadsBar,
          tableRows: data.leadsBar.map((r) => ({
            group: r.label,
            count: r.count,
            secondary: r.amount ? `$${Math.round(r.amount).toLocaleString()}` : "$0",
          })),
          kpi: null,
        };
      case "opps-by-stage":
      case "pipeline-by-stage":
        return {
          chartData: active === "pipeline-by-stage" ? data.oppsBar : data.oppsByStage,
          tableRows:
            active === "pipeline-by-stage"
              ? data.oppsBar.map((r) => ({
                  group: r.label,
                  count: r.count,
                  secondary: r.amount ? `$${Math.round(r.amount).toLocaleString()}` : "$0",
                }))
              : data.oppsByStage.map((r) => ({ group: r.label, count: r.count, secondary: "" })),
          kpi: null,
        };
      case "opps-bar":
        return {
          chartData: data.oppsBar,
          tableRows: data.oppsBar.map((r) => ({
            group: r.label,
            count: r.count,
            secondary: r.amount ? `$${Math.round(r.amount).toLocaleString()}` : "$0",
          })),
          kpi: null,
        };
      case "opp-win-rate": {
        const won =
          data.oppsByStage
            .filter((r) => /WON|CLOSED.*PAYMENT|CLOSED WON/i.test(r.label))
            .reduce((s, r) => s + r.count, 0) || 0;
        const lost =
          data.oppsByStage
            .filter((r) => /LOST|CANCELLED|CLOSED LOST/i.test(r.label))
            .reduce((s, r) => s + r.count, 0) || 0;
        const denom = won + lost;
        return {
          chartData: [
            { label: "Won", count: won },
            { label: "Lost", count: lost },
          ],
          tableRows: [
            { group: "Won", count: won, secondary: "" },
            { group: "Lost", count: lost, secondary: "" },
          ],
          kpi: {
            label: "Opportunity Win Rate",
            value: denom > 0 ? `${((won / denom) * 100).toFixed(1)}%` : "0%",
            sub: `${won.toLocaleString()} won / ${denom.toLocaleString()} closed`,
          },
        };
      }
      case "lead-dispo-day":
        return {
          chartData: [],
          tableRows: data.leadsDispo.map((r) => ({
            group: `${r.day} · ${r.status}`,
            count: r.count,
            secondary: r.isSubtotal ? "Subtotal" : "",
          })),
          kpi: null,
        };
      case "opp-dispo-day":
        return {
          chartData: [],
          tableRows: data.oppsDispo.map((r) => ({
            group: `${r.day} · ${r.status}`,
            count: r.count,
            secondary: r.isSubtotal ? "Subtotal" : "",
          })),
          kpi: null,
        };
      case "aging-opps":
        return {
          chartData: [],
          tableRows: data.keyDeals.map((d) => {
            const days = Math.floor(
              (Date.now() - new Date(d.updatedAt).getTime()) / 86400000,
            );
            return {
              group: `${d.name ?? "(no name)"} — ${d.stage}`,
              count: days,
              secondary: d.amount ? `$${Math.round(d.amount).toLocaleString()}` : "",
            };
          }),
          kpi: null,
        };
    }
  }, [data, active]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>
      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      <aside
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignSelf: "start",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#080707", marginBottom: 6 }}>
            Report
          </div>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as ReportKey)}
            style={selectStyle}
          >
            {REPORT_LIBRARY.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#080707", marginBottom: 6 }}>
            Date Range
          </div>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} style={selectStyle}>
            {PRESETS.map((p) => (
              <option key={p.preset} value={p.preset}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#080707", marginBottom: 6 }}>
            Group By
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={selectStyle}>
            <option value="status">Status</option>
            <option value="stage">Stage</option>
            <option value="day">Created Date</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#080707", marginBottom: 6 }}>
            Visualization
          </div>
          <select
            value={visual}
            onChange={(e) => setVisual(e.target.value as typeof visual)}
            style={selectStyle}
          >
            <option value="donut">Donut</option>
            <option value="bar">Bar</option>
            <option value="table">Table</option>
            <option value="kpi">KPI</option>
          </select>
        </div>
        <div style={{ fontSize: 11, color: "#706e6b" }}>{report.description}</div>
      </aside>

      {/* ── Viewer ───────────────────────────────────────────────────── */}
      <main
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          minHeight: 480,
        }}
      >
        <header
          style={{
            padding: 12,
            borderBottom: "1px solid #dddbda",
            background: "#fafaf9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#706e6b" }}>Report · {report.folder}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#080707" }}>{report.name}</div>
          </div>
          <div style={{ fontSize: 12, color: "#706e6b" }}>
            {loading ? "Loading…" : `${tableRows.length} rows`}
          </div>
        </header>
        {visual === "kpi" && kpi ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#080707", marginTop: 8 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: "#706e6b", marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ) : null}
        {visual === "donut" && chartData.length > 0 ? (
          <div style={{ padding: 16, height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  isAnimationActive={false}
                >
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        {visual === "bar" && chartData.length > 0 ? (
          <div style={{ padding: 16, height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 32, right: 16 }}>
                <CartesianGrid stroke="#f3f3f3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={160} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Count" fill="#1589ee" isAnimationActive={false} />
                {(chartData as { amount?: number }[]).some((r) => r.amount) ? (
                  <Bar dataKey="amount" name="Amount" fill="#16325c" isAnimationActive={false} />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        {visual === "table" ? (
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "#fafaf9" }}>
                <tr>
                  {["Group", "Count", "Secondary"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Count" ? "right" : "left",
                        padding: "6px 12px",
                        borderBottom: "1px solid #dddbda",
                        color: "#3e3e3c",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "6px 12px", borderBottom: "1px solid #f3f3f3" }}>
                      {r.group}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        textAlign: "right",
                        borderBottom: "1px solid #f3f3f3",
                      }}
                    >
                      {r.count.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        borderBottom: "1px solid #f3f3f3",
                        color: "#706e6b",
                      }}
                    >
                      {r.secondary}
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
                      No data in selected range
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  background: "#fff",
  color: "#080707",
  height: 32,
};
