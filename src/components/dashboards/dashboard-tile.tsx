"use client";

import { useEffect, useState } from "react";
import { Trash2, ChevronLeft, ChevronRight, ChevronDown, BarChart3, TrendingUp, DollarSign } from "@/components/icons/lucide";
import type { DashboardTileData } from "./dashboard-client";

interface RegistryEntry {
  key: string;
  label: string;
  kind: "scalar" | "bar";
}

interface ReportListItem {
  id: string;
  name: string;
}

type ScalarData = { value: number; format?: "currency" | "number" | "percent" };
type BarData = { buckets: { label: string; value: number }[] };
type TileData = ScalarData | BarData | { error: string };

const TILE_KINDS = [
  { value: "kpi", label: "KPI" },
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "bar", label: "Bar Chart" },
  { value: "table", label: "Table" },
  { value: "report", label: "Saved Report" },
];

const KIND_THEMES: Record<string, { grad: string; icon: React.ReactNode }> = {
  kpi: {
    grad: "linear-gradient(135deg, #0034e4, #3052ff)",
    icon: <TrendingUp className="size-4 text-white" />,
  },
  count: {
    grad: "linear-gradient(135deg, #5c5c8a, #7474a8)",
    icon: <BarChart3 className="size-4 text-white" />,
  },
  sum: {
    grad: "linear-gradient(135deg, #1a7d37, #2db84d)",
    icon: <DollarSign className="size-4 text-white" />,
  },
  bar: {
    grad: "linear-gradient(135deg, #b48c00, #d1a000)",
    icon: <BarChart3 className="size-4 text-white" />,
  },
  table: {
    grad: "linear-gradient(135deg, #5c5c8a, #7474a8)",
    icon: <BarChart3 className="size-4 text-white" />,
  },
  report: {
    grad: "linear-gradient(135deg, #5c5c8a, #7474a8)",
    icon: <BarChart3 className="size-4 text-white" />,
  },
};

function isError(d: TileData | null): d is { error: string } {
  return !!d && typeof (d as { error?: string }).error === "string";
}

function isBar(d: TileData | null): d is BarData {
  return !!d && Array.isArray((d as BarData).buckets);
}

function isScalar(d: TileData | null): d is ScalarData {
  return !!d && typeof (d as ScalarData).value === "number";
}

function formatNumber(n: number, fmt?: "currency" | "number" | "percent"): string {
  if (fmt === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }
  if (fmt === "percent") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US").format(n);
}

interface Props {
  tile: DashboardTileData;
  editing: boolean;
  onUpdate: (patch: Partial<DashboardTileData>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function DashboardTile({ tile, editing, onUpdate, onDelete }: Props) {
  const [data, setData] = useState<TileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleDraft, setTitleDraft] = useState(tile.title);
  const [registry, setRegistry] = useState<RegistryEntry[] | null>(null);
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [reportsAvailable, setReportsAvailable] = useState(true);

  // Fetch tile data when the relevant inputs change.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboards/tile-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: tile.kind,
            queryKey: tile.queryKey,
            reportId: tile.reportId,
            config: tile.config,
          }),
        });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ error: "Failed to load" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tile.kind, tile.queryKey, tile.reportId, tile.config]);

  // Fetch registry + reports lazily when editing.
  useEffect(() => {
    if (!editing || registry) return;
    let cancelled = false;
    fetch(`/api/dashboards/query-registry`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setRegistry(j.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setRegistry([]);
      });
    fetch(`/api/reports`)
      .then((r) => {
        if (!r.ok) throw new Error("no reports");
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        const items = Array.isArray(j) ? j : (j.items ?? j.reports ?? []);
        setReports(items);
        setReportsAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setReportsAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, registry]);

  const theme = KIND_THEMES[tile.kind] ?? KIND_THEMES.kpi;

  async function bumpSize(dw: number, dh: number) {
    const w = Math.max(1, Math.min(12, (tile.position?.w ?? 3) + dw));
    const h = Math.max(1, Math.min(8, (tile.position?.h ?? 2) + dh));
    await onUpdate({ position: { ...tile.position, w, h } });
  }

  async function commitTitle() {
    if (titleDraft.trim() && titleDraft !== tile.title) {
      await onUpdate({ title: titleDraft.trim() });
    } else {
      setTitleDraft(tile.title);
    }
  }

  async function changeKind(kind: string) {
    // Default to a sensible queryKey when switching kinds.
    let queryKey = tile.queryKey;
    if (registry) {
      const wantKind = kind === "bar" ? "bar" : "scalar";
      if (!queryKey || !registry.find((r) => r.key === queryKey && r.kind === wantKind)) {
        queryKey = registry.find((r) => r.kind === wantKind)?.key ?? null;
      }
    }
    await onUpdate({ kind, queryKey });
  }

  return (
    <div
      className="bg-white rounded-xl h-full flex flex-col overflow-hidden"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f2f3ff] flex items-center gap-2">
        <span
          className="size-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: theme.grad }}
        >
          {theme.icon}
        </span>
        {editing ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="flex-1 text-[13px] font-bold text-[#131b2e] bg-transparent outline-none border-b border-[#e7e7ee] focus:border-[#3052ff]"
          />
        ) : (
          <h3 className="flex-1 text-[13px] font-bold text-[#131b2e] truncate">{tile.title}</h3>
        )}
        {editing && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete tile"
            className="text-[#942b00] hover:bg-[#fbeeea] rounded p-1"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-3 w-24 rounded bg-[#f2f3ff] animate-pulse" />
          </div>
        ) : isError(data) ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <div className="text-[12px] font-semibold text-[#942b00]">Tile failed</div>
              <div className="text-[11px] text-[#747474] mt-1">{data.error}</div>
            </div>
          </div>
        ) : tile.kind === "bar" && isBar(data) ? (
          <BarChartView buckets={data.buckets} />
        ) : isScalar(data) ? (
          <ScalarView
            value={data.value}
            format={data.format}
            kind={tile.kind}
          />
        ) : (
          <div className="text-[12px] text-[#747474]">No data</div>
        )}
      </div>

      {/* Edit controls */}
      {editing && (
        <div className="border-t border-[#f2f3ff] p-3 space-y-2 bg-[#fbfbff]">
          <div className="flex gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#747474] w-12 flex items-center">
              Kind
            </label>
            <select
              value={tile.kind}
              onChange={(e) => changeKind(e.target.value)}
              className="flex-1 text-[12px] rounded border border-[#c9c9c9] px-2 py-1 bg-white"
            >
              {TILE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          {tile.kind !== "report" ? (
            <div className="flex gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[#747474] w-12 flex items-center">
                Query
              </label>
              <select
                value={tile.queryKey ?? ""}
                onChange={(e) => onUpdate({ queryKey: e.target.value || null })}
                className="flex-1 text-[12px] rounded border border-[#c9c9c9] px-2 py-1 bg-white"
              >
                <option value="">(select)</option>
                {registry
                  ?.filter((r) =>
                    tile.kind === "bar" ? r.kind === "bar" : r.kind === "scalar",
                  )
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[#747474] w-12 flex items-center">
                Report
              </label>
              {reportsAvailable ? (
                <select
                  value={tile.reportId ?? ""}
                  onChange={(e) => onUpdate({ reportId: e.target.value || null })}
                  className="flex-1 text-[12px] rounded border border-[#c9c9c9] px-2 py-1 bg-white"
                >
                  <option value="">(select)</option>
                  {reports?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-[11px] text-[#747474] italic">
                  Reports not available yet
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#747474] w-12">
              Size
            </label>
            <SizeBtn onClick={() => bumpSize(-1, 0)} title="Narrower">
              <ChevronLeft className="size-3" />
            </SizeBtn>
            <span className="text-[11px] text-[#444656] font-mono">
              w{tile.position?.w ?? 3}
            </span>
            <SizeBtn onClick={() => bumpSize(1, 0)} title="Wider">
              <ChevronRight className="size-3" />
            </SizeBtn>
            <SizeBtn onClick={() => bumpSize(0, -1)} title="Shorter">
              <ChevronDown className="size-3 rotate-180" />
            </SizeBtn>
            <span className="text-[11px] text-[#444656] font-mono">
              h{tile.position?.h ?? 2}
            </span>
            <SizeBtn onClick={() => bumpSize(0, 1)} title="Taller">
              <ChevronDown className="size-3" />
            </SizeBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function SizeBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="size-6 rounded border border-[#c9c9c9] bg-white flex items-center justify-center text-[#131b2e] hover:bg-[#f2f3ff]"
    >
      {children}
    </button>
  );
}

function ScalarView({
  value,
  format,
  kind,
}: {
  value: number;
  format?: "currency" | "number" | "percent";
  kind: string;
}) {
  const color =
    kind === "sum"
      ? "#1a7d37"
      : kind === "count"
        ? "#5c5c8a"
        : "#0034e4";
  return (
    <div className="h-full flex flex-col justify-center">
      <div
        className="text-[36px] font-bold leading-none tracking-tight"
        style={{ color, fontFamily: "Manrope, sans-serif" }}
      >
        {formatNumber(value, format)}
      </div>
    </div>
  );
}

function BarChartView({ buckets }: { buckets: { label: string; value: number }[] }) {
  if (buckets.length === 0) {
    return <div className="text-[12px] text-[#747474]">No data</div>;
  }
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const top = buckets.slice(0, 10);
  return (
    <div className="h-full overflow-y-auto space-y-1.5">
      {top.map((b, i) => {
        const pct = (b.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div className="w-28 truncate text-[#444656]" title={b.label}>
              {b.label}
            </div>
            <div className="flex-1 h-4 bg-[#f2f3ff] rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #3052ff, #5b78ff)",
                }}
              />
            </div>
            <div className="w-10 text-right font-semibold text-[#131b2e]">
              {b.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
