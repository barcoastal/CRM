"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClosersOnCallBoard } from "@/components/dialer/closers-on-call-board";

interface Transfer { id: string; at: string; clientName: string | null; debt: number | null; debtLabel: string | null; tier: number | null; status: string; }
interface Row {
  id: string; name: string; tier: number | null;
  transferCount: number; transferDebt: number;
  closedCount: number; closedDebt: number;
  firstPaymentCount: number;
  transfers: Transfer[];
}

const compact = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n || 0).toLocaleString()}`);
const TIER = { 1: { c: "#7f8de1", label: "T1" }, 2: { c: "#0176d3", label: "T2" }, 3: { c: "#2e844a", label: "T3" } } as Record<number, { c: string; label: string }>;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const won = (s: string) => /closed won/i.test(s);
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Preset = "today" | "yesterday" | "week" | "month" | "last" | "custom";

// Range boundaries in the viewer's local time (Eastern for the US floor).
function rangeFor(preset: Preset, cf: string, ct: string): { from: Date; to: Date } {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today": return { from: startToday, to: now };
    case "yesterday": return { from: new Date(startToday.getTime() - 86400000), to: startToday };
    case "week": { const dow = now.getDay(); return { from: new Date(startToday.getTime() - dow * 86400000), to: now }; }
    case "month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "last": return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "custom": {
      const from = cf ? new Date(cf + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
      const to = ct ? new Date(ct + "T23:59:59") : now;
      return { from, to };
    }
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" }, { key: "month", label: "This month" },
  { key: "last", label: "Last month" }, { key: "custom", label: "Custom" },
];

export default function CloserDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [preset, setPreset] = useState<Preset>("month");
  const today = ymd(new Date());
  const [cf, setCf] = useState(today);
  const [ct, setCt] = useState(today);

  const { from, to } = useMemo(() => rangeFor(preset, cf, ct), [preset, cf, ct]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/dialer/closer-dashboard?from=${encodeURIComponent(iso(from))}&to=${encodeURIComponent(iso(to))}`);
        if (r.ok && alive) setRows((await r.json()).rows ?? []);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    }
    void load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [from, to]);

  const t = rows.reduce((a, r) => ({ tr: a.tr + r.transferCount, cl: a.cl + r.closedCount, fp: a.fp + r.firstPaymentCount, trD: a.trD + r.transferDebt, clD: a.clD + r.closedDebt }), { tr: 0, cl: 0, fp: 0, trD: 0, clD: 0 });
  const rangeLabel = (() => {
    const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    const f = from.toLocaleDateString("en-US", opt);
    const tt = new Date(to.getTime() - 1).toLocaleDateString("en-US", opt);
    return f === tt ? f : `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${tt}`;
  })();

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, padding: "16px 18px", flex: 1, minWidth: 150 };
  const cLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#5c6b7a" };
  const cNum: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: "#16325c", marginTop: 4, lineHeight: 1.1 };
  const cSub: React.CSSProperties = { fontSize: 12, color: "#8a94a6", marginTop: 2 };
  const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#5c6b7a", borderBottom: "1px solid #e5e9f0", background: "#f7f9fc" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #eef1f6", color: "#16325c" };
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "0 0 4px" }}>Closer Dashboard</h1>
      <p style={{ fontSize: 13, color: "#8a94a6", margin: "0 0 16px" }}>Transfers, closes, and debt per closer for the selected period. Live from opportunities.</p>

      {/* Live calls happening right now */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#b3261e", display: "inline-block" }} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#16325c", margin: 0 }}>Live calls now</h2>
          <span style={{ fontSize: 12, color: "#8a94a6" }}>fronters on a call, with the client and debt</span>
        </div>
        <ClosersOnCallBoard />
      </div>

      {/* Date range controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer",
              border: preset === p.key ? "1px solid #0176d3" : "1px solid #d8dde6",
              background: preset === p.key ? "#0176d3" : "#fff", color: preset === p.key ? "#fff" : "#16325c" }}>
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
            <input type="date" value={cf} max={today} onChange={(e) => setCf(e.target.value)} style={{ border: "1px solid #d8dde6", borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
            <span style={{ color: "#8a94a6" }}>to</span>
            <input type="date" value={ct} max={today} onChange={(e) => setCt(e.target.value)} style={{ border: "1px solid #d8dde6", borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
          </span>
        )}
      </div>

      {/* Range being viewed */}
      <div style={{ fontSize: 13, color: "#16325c", fontWeight: 600, margin: "0 0 12px" }}>
        Showing <span style={{ color: "#0176d3" }}>{rangeLabel}</span>
        <span style={{ color: "#8a94a6", fontWeight: 400 }}> · {rows.length} tiered closers</span>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={card}><div style={cLbl}>Transfers</div><div style={cNum}>{t.tr}</div><div style={cSub}>{compact(t.trD)} in debt</div></div>
        <div style={card}><div style={cLbl}>Closed</div><div style={{ ...cNum, color: "#2e844a" }}>{t.cl}</div><div style={cSub}>signed this period</div></div>
        <div style={card}><div style={cLbl}>First payment</div><div style={{ ...cNum, color: "#0176d3" }}>{t.fp}</div><div style={cSub}>{t.cl ? Math.round((t.fp / t.cl) * 100) : 0}% of closed paid</div></div>
        <div style={card}><div style={cLbl}>Debt closed</div><div style={{ ...cNum, color: "#2e844a" }}>{compact(t.clD)}</div><div style={cSub}>signed this period</div></div>
      </div>

      {/* Per-closer table */}
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 30 }}></th>
              <th style={{ ...th, width: 30 }}>#</th>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={{ ...th, textAlign: "right" }}>Transfers</th>
              <th style={{ ...th, textAlign: "right" }}>Debt</th>
              <th style={{ ...th, textAlign: "right" }}>Closed</th>
              <th style={{ ...th, textAlign: "right" }}>1st payment</th>
              <th style={{ ...th, textAlign: "right" }}>Debt closed</th>
              <th style={{ ...th, textAlign: "right" }}>Close %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tr = r.tier ? TIER[r.tier] : null;
              const rate = r.transferCount ? Math.round((r.closedCount / r.transferCount) * 100) : 0;
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))} style={{ cursor: r.transfers.length ? "pointer" : "default" }} className="cd-row">
                    <td style={{ ...td, color: "#b0bac9", textAlign: "center" }}>{r.transfers.length ? (open[r.id] ? "▾" : "▸") : ""}</td>
                    <td style={{ ...td, color: "#b0bac9", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                    <td style={td}>{tr ? <span style={{ background: tr.c, color: "#fff", padding: "2px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{tr.label}</span> : "-"}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{r.transferCount}</td>
                    <td style={num}>{compact(r.transferDebt)}</td>
                    <td style={{ ...num, fontWeight: 800, color: "#2e844a" }}>{r.closedCount}</td>
                    <td style={{ ...num, fontWeight: 700, color: "#0176d3" }}>{r.firstPaymentCount}</td>
                    <td style={{ ...num, color: "#2e844a", fontWeight: 700 }}>{compact(r.closedDebt)}</td>
                    <td style={num}>{rate}%</td>
                  </tr>
                  {open[r.id] && r.transfers.map((x) => (
                    <tr key={x.id} style={{ background: "#f7f9fc" }}>
                      <td style={td} colSpan={2}></td>
                      <td style={{ ...td, fontSize: 12 }}><Link href={`/opportunities/${x.id}`} style={{ color: "#0176d3", textDecoration: "none", fontWeight: 600 }}>{x.clientName ?? "Opportunity"}</Link></td>
                      <td style={{ ...td, fontSize: 12, color: "#8a94a6" }}>{fmtDate(x.at)}</td>
                      <td style={{ ...num, fontSize: 13, fontWeight: 700 }} colSpan={2}>{x.debtLabel ?? "-"}</td>
                      <td style={{ ...td, fontSize: 12 }} colSpan={4}><span style={{ fontWeight: 700, color: won(x.status) ? "#2e844a" : "#5c6b7a" }}>{x.status}</span></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 28 }}>No transfers in this period.</td></tr>}
            {loading && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 28 }}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
      <style>{`.cd-row:hover td { background: #f2f6fc; }`}</style>
    </div>
  );
}
