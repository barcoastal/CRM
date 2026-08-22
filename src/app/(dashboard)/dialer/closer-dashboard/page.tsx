"use client";

import { Fragment, useEffect, useState } from "react";

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

const money = (n: number) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "-");
const TIER_COLOR: Record<number, string> = { 1: "#7f8de1", 2: "#0176d3", 3: "#2e844a" };
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  const totals = rows.reduce((a, r) => ({ today: a.today + r.todayCount, month: a.month + r.monthCount, monthDebt: a.monthDebt + r.monthDebt }), { today: 0, month: 0, monthDebt: 0 });

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Closer Dashboard</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Transfer calls each closer received today and this month, and the debt of each. Today: {totals.today} · This month: {totals.month} transfers ({money(totals.monthDebt)}).
        </p>
      </header>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}></th>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={{ ...th, textAlign: "right" }}>Transfers today</th>
              <th style={{ ...th, textAlign: "right" }}>Debt today</th>
              <th style={{ ...th, textAlign: "right" }}>Transfers this month</th>
              <th style={{ ...th, textAlign: "right" }}>Debt this month</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))} style={{ cursor: r.transfers.length ? "pointer" : "default" }}>
                  <td style={{ ...td, color: "#a0a0a0" }}>{r.transfers.length ? (open[r.id] ? "▾" : "▸") : ""}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                  <td style={td}>{r.tier ? <span style={{ background: TIER_COLOR[r.tier], color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>T{r.tier}</span> : "-"}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{r.todayCount}</td>
                  <td style={num}>{money(r.todayDebt)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{r.monthCount}</td>
                  <td style={num}>{money(r.monthDebt)}</td>
                </tr>
                {open[r.id] && r.transfers.map((t) => (
                  <tr key={t.id} style={{ background: "#fafafa" }}>
                    <td style={td}></td>
                    <td style={{ ...td, color: "#747474", fontSize: 12 }} colSpan={2}>{fmtDate(t.at)}</td>
                    <td style={{ ...td, fontSize: 12 }} colSpan={2}>{t.clientName ?? "-"}</td>
                    <td style={{ ...num, fontSize: 12, fontWeight: 700 }} colSpan={1}>{t.debtLabel ?? "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: t.status === "CLOSED" ? "#2e844a" : t.status === "LOST" ? "#b3261e" : "#747474" }}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 24 }}>No transfers yet. Assign closers from the Floor Manager.</td></tr>
            )}
            {loading && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 24 }}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
