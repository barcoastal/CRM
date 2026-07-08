"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DonutCard, type DonutSlice } from "./donut-card";
import { BarChartCard, type BarDatum } from "./bar-chart-card";
import { DispoByDayTable, type DispoRow } from "./dispo-by-day-table";
import { RecentRecordsCard, type RecentRecord } from "./recent-records-card";
import { KeyDealsCard, type KeyDeal } from "./key-deals-card";

interface DashboardData {
  generatedAt: string;
  totals: { totalLeads: number; totalOpps: number };
  leadsByStatus: DonutSlice[];
  oppsByStage: DonutSlice[];
  leadsBar: BarDatum[];
  oppsBar: BarDatum[];
  leadsDispo: DispoRow[];
  oppsDispo: DispoRow[];
  todaysTasks: {
    id: string;
    subject: string;
    priority: string;
    dueDate: string | null;
    status: string;
  }[];
  todaysEvents: {
    id: string;
    subject: string;
    startAt: string;
    endAt: string;
    location: string | null;
  }[];
  recentRecords: RecentRecord[];
  keyDeals: KeyDeal[];
}

type DateRange = { from?: string; to?: string };

const PRESETS: { label: string; preset: string }[] = [
  { label: "All Time", preset: "all" },
  { label: "Today", preset: "today" },
  { label: "Yesterday", preset: "yesterday" },
  { label: "This Week", preset: "wtd" },
  { label: "This Month", preset: "mtd" },
  { label: "This Quarter", preset: "qtd" },
  { label: "This Year", preset: "ytd" },
  { label: "Last 7 Days", preset: "last7" },
  { label: "Last 30 Days", preset: "last30" },
  { label: "Last 90 Days", preset: "last90" },
];

function presetToRange(preset: string): DateRange {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return { from: ymd(y), to: ymd(y) };
    }
    case "wtd": {
      const dayOfWeek = now.getDay(); // 0=Sun
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: ymd(monday), to: todayStr };
    }
    case "mtd": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ymd(first), to: todayStr };
    }
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(now.getFullYear(), q, 1);
      return { from: ymd(first), to: todayStr };
    }
    case "ytd": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: ymd(first), to: todayStr };
    }
    case "last7":
    case "last30":
    case "last90": {
      const days = preset === "last7" ? 7 : preset === "last30" ? 30 : 90;
      const start = new Date(now);
      start.setDate(now.getDate() - days);
      return { from: ymd(start), to: todayStr };
    }
    default:
      return {};
  }
}

function fmtSince(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.floor((now - then) / 1000));
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function FilterDropdown({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (preset: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}>
      <label style={{ fontSize: 11, color: "#444444", fontWeight: 600 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "6px 8px",
          fontSize: 13,
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          background: "#fff",
          color: "#181818",
          height: 32,
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.preset} value={p.preset}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ManagerDashboard({ userName }: { userName: string }) {
  const [createPreset, setCreatePreset] = useState("all");
  const [modPreset, setModPreset] = useState("all");
  const [progPreset, setProgPreset] = useState("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Re-render the "Last refreshed X ago" timer every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    const create = presetToRange(createPreset);
    if (create.from) p.set("createFrom", create.from);
    if (create.to) p.set("createTo", create.to);
    const mod = presetToRange(modPreset);
    if (mod.from) p.set("lastModifiedFrom", mod.from);
    if (mod.to) p.set("lastModifiedTo", mod.to);
    const prog = presetToRange(progPreset);
    if (prog.from) p.set("programStartFrom", prog.from);
    if (prog.to) p.set("programStartTo", prog.to);
    return p.toString();
  }, [createPreset, modPreset, progPreset]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/manager${params ? "?" + params : ""}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (err) {
      console.error("Dashboard load failed", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const lastRefreshed = data
    ? `Last refreshed ${fmtSince(data.generatedAt)}. Refresh this dashboard to see the latest data.`
    : "";
  // tick is consumed to keep ESLint happy and force re-derivation
  void tick;

  const asOf = data
    ? `As of ${new Date(data.generatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: "#0176d3",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
                <use xlinkHref="/slds/icons/standard-sprite/svg/symbols.svg#dashboard" />
              </svg>
            </span>
            <div>
              <div style={{ fontSize: 11, color: "#747474" }}>Dashboard</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#181818" }}>
                Manager Dashboard
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnStyle("ghost")} onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#747474", marginBottom: 12 }}>
          {data ? lastRefreshed : "Loading…"} Viewing as {userName}.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <FilterDropdown label="Create Date" value={createPreset} onChange={setCreatePreset} />
          <FilterDropdown label="Last Modified Date" value={modPreset} onChange={setModPreset} />
          <FilterDropdown
            label="Program Start Date"
            value={progPreset}
            onChange={setProgPreset}
          />
        </div>
      </header>

      {/* ── Row 1: Leads charts ───────────────────────────────────────── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <DonutCard
          title="Leads"
          subtitle="Record Count, by Status"
          data={data?.leadsByStatus ?? []}
          reportLink="/reports?report=leads-by-status"
          asOf={asOf}
        />
        <BarChartCard
          title="Leads Report"
          subtitle="Record Count + Total Debt by Status"
          data={data?.leadsBar ?? []}
          reportLink="/reports?report=leads-bar"
          asOf={asOf}
        />
        <DispoByDayTable
          title="Lead Disposition by Day"
          rows={data?.leadsDispo ?? []}
          statusLabel="Lead Status"
          reportLink="/reports?report=lead-dispo-day"
          asOf={asOf}
        />
      </section>

      {/* ── Row 2: Opportunities charts ──────────────────────────────── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <DonutCard
          title="Opportunities"
          subtitle="Record Count, by Stage"
          data={data?.oppsByStage ?? []}
          reportLink="/reports?report=opps-by-stage"
          asOf={asOf}
        />
        <BarChartCard
          title="Opportunities Report"
          subtitle="Record Count + Amount by Stage"
          data={data?.oppsBar ?? []}
          reportLink="/reports?report=opps-bar"
          asOf={asOf}
        />
        <DispoByDayTable
          title="Opportunities Disposition by Day"
          rows={data?.oppsDispo ?? []}
          statusLabel="Opportunity Stage"
          reportLink="/reports?report=opp-dispo-day"
          asOf={asOf}
        />
      </section>

      {/* ── Today's Tasks ─────────────────────────────────────────────── */}
      <TodayCard title="Today's Tasks" empty="Nothing due today. Be a go getter, and check back soon.">
        {(data?.todaysTasks ?? []).map((t) => (
          <div
            key={t.id}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #f3f3f3",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 12,
            }}
          >
            <span>{t.subject}</span>
            <span style={{ color: "#747474" }}>
              {t.dueDate ? new Date(t.dueDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
            </span>
          </div>
        ))}
      </TodayCard>

      {/* ── Today's Events ────────────────────────────────────────────── */}
      <TodayCard title="Today's Events" empty="Looks like you're free, enjoy the rest of the day." viewAllHref="/events">
        {(data?.todaysEvents ?? []).map((ev) => (
          <div
            key={ev.id}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #f3f3f3",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 12,
            }}
          >
            <span>{ev.subject}</span>
            <span style={{ color: "#747474" }}>
              {new Date(ev.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </TodayCard>

      {/* ── Assistant placeholder ─────────────────────────────────────── */}
      <TodayCard title="Assistant" empty="Nothing needs your attention right now. Check back later.">
        {null}
      </TodayCard>

      {/* ── Recent Records + Key Deals ────────────────────────────────── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <RecentRecordsCard records={data?.recentRecords ?? []} />
        <KeyDealsCard deals={data?.keyDeals ?? []} />
      </section>
    </div>
  );
}

function btnStyle(variant: "primary" | "ghost"): React.CSSProperties {
  if (variant === "primary") {
    return {
      background: "#0176d3",
      color: "#fff",
      border: "1px solid #0176d3",
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 600,
      borderRadius: 4,
      cursor: "pointer",
      height: 28,
    };
  }
  return {
    background: "#fff",
    color: "#0176d3",
    border: "1px solid #c9c9c9",
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
    cursor: "pointer",
    height: 28,
  };
}

function TodayCard({
  title,
  children,
  empty,
  viewAllHref,
}: {
  title: string;
  children: React.ReactNode;
  empty: string;
  viewAllHref?: string;
}) {
  const hasContent = !!children && (Array.isArray(children) ? children.length > 0 : true);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #c9c9c9",
          background: "#fafaf9",
          fontSize: 14,
          fontWeight: 700,
          color: "#181818",
        }}
      >
        {title}
      </header>
      {hasContent ? (
        <div>{children}</div>
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "#747474",
            fontSize: 12,
          }}
        >
          {empty}
        </div>
      )}
      <footer
        style={{
          borderTop: "1px solid #c9c9c9",
          padding: "6px 12px",
          textAlign: "center",
          fontSize: 11,
          color: "#0176d3",
          fontWeight: 600,
          background: "#fafaf9",
        }}
      >
        {viewAllHref ? (
          <a href={viewAllHref} style={{ color: "#0176d3", textDecoration: "none" }}>
            View Calendar
          </a>
        ) : (
          "View All"
        )}
      </footer>
    </div>
  );
}
