"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

interface Transfer {
  id: string;
  at: string;
  clientName: string | null;
  debt: number | null;
  debtLabel: string | null;
  tier: number | null;
  status: string;
}
interface Row {
  id: string;
  name: string;
  tier: number | null;
  todayCount: number;
  todayDebt: number;
  monthCount: number;
  monthDebt: number;
  transfers: Transfer[];
}

const money = (n: number) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "$0");
const compact = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : money(n));
const TIER = { 1: { c: "#7f8de1", label: "T1" }, 2: { c: "#0176d3", label: "T2" }, 3: { c: "#2e844a", label: "T3" } } as Record<number, { c: string; label: string }>;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const won = (s: string) => /closed won/i.test(s);

export default function CloserDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/dialer/closer-dashboard");
        if (r.ok && alive) setRows((await r.json()).rows ?? []);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    }
    void load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const t = rows.reduce((a, r) => ({ today: a.today + r.todayCount, month: a.month + r.monthCount, todayDebt: a.todayDebt + r.todayDebt, monthDebt: a.monthDebt + r.monthDebt }), { today: 0, month: 0, todayDebt: 0, monthDebt: 0 });

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, padding: "16px 18px", flex: 1, minWidth: 150 };
  const cardLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#5c6b7a" };
  const cardNum: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: "#16325c", marginTop: 4, lineHeight: 1.1 };
  const cardSub: React.CSSProperties = { fontSize: 12, color: "#8a94a6", marginTop: 2 };
  const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#5c6b7a", borderBottom: "1px solid #e5e9f0", background: "#f7f9fc" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #eef1f6", color: "#16325c" };
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "0 0 4px" }}>Closer Dashboard</h1>
      <p style={{ fontSize: 13, color: "#8a94a6", margin: "0 0 16px" }}>Transfer calls each closer received, with the debt behind them. Live from opportunities.</p>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={card}><div style={cardLabel}>Transfers today</div><div style={cardNum}>{t.today}</div><div style={cardSub}>{compact(t.todayDebt)} in debt</div></div>
        <div style={card}><div style={cardLabel}>Transfers this month</div><div style={cardNum}>{t.month}</div><div style={cardSub}>{compact(t.monthDebt)} in debt</div></div>
        <div style={card}><div style={cardLabel}>Debt this month</div><div style={{ ...cardNum, color: "#2e844a" }}>{compact(t.monthDebt)}</div><div style={cardSub}>across {rows.length} closers</div></div>
        <div style={card}><div style={cardLabel}>Avg per closer</div><div style={cardNum}>{rows.length ? Math.round(t.month / rows.length) : 0}</div><div style={cardSub}>transfers this month</div></div>
      </div>

      {/* Per-closer table */}
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 34 }}></th>
              <th style={{ ...th, width: 34 }}>#</th>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={{ ...th, textAlign: "right" }}>Today</th>
              <th style={{ ...th, textAlign: "right" }}>Debt today</th>
              <th style={{ ...th, textAlign: "right" }}>This month</th>
              <th style={{ ...th, textAlign: "right" }}>Debt this month</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tr = r.tier ? TIER[r.tier] : null;
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))} style={{ cursor: r.transfers.length ? "pointer" : "default" }} className="cd-row">
                    <td style={{ ...td, color: "#b0bac9", textAlign: "center" }}>{r.transfers.length ? (open[r.id] ? "▾" : "▸") : ""}</td>
                    <td style={{ ...td, color: "#b0bac9", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                    <td style={td}>{tr ? <span style={{ background: tr.c, color: "#fff", padding: "2px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{tr.label}</span> : "-"}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{r.todayCount}</td>
                    <td style={num}>{compact(r.todayDebt)}</td>
                    <td style={{ ...num, fontWeight: 800, fontSize: 15 }}>{r.monthCount}</td>
                    <td style={{ ...num, color: "#2e844a", fontWeight: 700 }}>{compact(r.monthDebt)}</td>
                  </tr>
                  {open[r.id] && r.transfers.map((x) => (
                    <tr key={x.id} style={{ background: "#f7f9fc" }}>
                      <td style={td}></td>
                      <td style={td}></td>
                      <td style={{ ...td, fontSize: 12 }}>
                        <Link href={`/opportunities/${x.id}`} style={{ color: "#0176d3", textDecoration: "none", fontWeight: 600 }}>{x.clientName ?? "Opportunity"}</Link>
                      </td>
                      <td style={{ ...td, fontSize: 12, color: "#8a94a6" }}>{fmtDate(x.at)}</td>
                      <td style={{ ...num, fontSize: 12 }} colSpan={2}>
                        <span style={{ fontWeight: 700, color: won(x.status) ? "#2e844a" : "#5c6b7a" }}>{x.status}</span>
                      </td>
                      <td style={{ ...num, fontSize: 13, fontWeight: 700 }} colSpan={2}>{x.debtLabel ?? "-"}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 28 }}>No tiered closers yet.</td></tr>}
            {loading && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 28 }}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
      <style>{`.cd-row:hover td { background: #f2f6fc; }`}</style>
    </div>
  );
}
