"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface OnCallRow {
  id: string;
  name: string;
  tier: number | null;
  clientName: string | null;
  clientDebtLabel: string | null;
  eligibleTier: number | null;
  leadId: string | null;
}
interface StatRow {
  id: string;
  name: string;
  tier: number | null;
  state: "READY" | "ON_CALL" | "NOT_READY" | "OFFLINE";
  free: boolean;
  callsTaken: number;
  debtAttempted: number;
  closedCount: number;
  debtClosed: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const TIER_COLOR: Record<number, string> = { 1: "#7f8de1", 2: "#0176d3", 3: "#2e844a" };
const STATE_DOT: Record<StatRow["state"], string> = { READY: "#2e844a", ON_CALL: "#b3261e", NOT_READY: "#fe9339", OFFLINE: "#c9c9c9" };

interface HandoffRow {
  id: string;
  createdAt: string;
  fronter: string | null;
  closer: string | null;
  clientName: string | null;
  debtLabel: string | null;
  tier: number | null;
  status: string;
}

export default function FloorManagerPage() {
  const [onCall, setOnCall] = useState<OnCallRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRow[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b, h] = await Promise.all([
        fetch("/api/dialer/closers-on-call").then((r) => (r.ok ? r.json() : { rows: [] })),
        fetch("/api/dialer/closer-stats").then((r) => (r.ok ? r.json() : { rows: [] })),
        fetch("/api/dialer/assign").then((r) => (r.ok ? r.json() : { rows: [] })),
      ]);
      setOnCall(a.rows ?? []);
      setStats(b.rows ?? []);
      setHandoffs(h.rows ?? []);
    } catch { /* ignore */ }
  }, []);

  async function mark(id: string, status: "CLOSED" | "LOST") {
    setBusy(id);
    try {
      await fetch("/api/dialer/assign", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      await load();
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function assign(row: OnCallRow, closerId: string, closerName: string) {
    setBusy(row.id);
    try {
      const res = await fetch("/api/dialer/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fronterId: row.id,
          leadId: row.leadId,
          clientName: row.clientName,
          debtLabel: row.clientDebtLabel,
          tier: row.eligibleTier,
          closerId,
        }),
      });
      if (res.ok) setAssigned((p) => ({ ...p, [row.id]: closerName }));
    } finally {
      setBusy(null);
    }
  }

  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };
  const numTd: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  const freeInTier = (tier: number | null) => stats.filter((s) => s.free && s.tier === tier);

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Floor Manager</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Assign each fronter&apos;s qualified lead to a closer in the right tier. Live, updates every 5s.
        </p>
      </header>

      {/* Live floor - assign a closer */}
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700 }}>Live floor - assign a closer</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fronter</th>
              <th style={th}>Client</th>
              <th style={th}>Debt</th>
              <th style={th}>Needs tier</th>
              <th style={th}>Assign closer</th>
            </tr>
          </thead>
          <tbody>
            {onCall.map((r) => {
              const options = freeInTier(r.eligibleTier);
              const done = assigned[r.id];
              return (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                  <td style={td}>{r.leadId ? <Link href={`/leads/${r.leadId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{r.clientName ?? "?"}</Link> : (r.clientName ?? "?")}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{r.clientDebtLabel ?? <span style={{ color: "#a0a0a0", fontWeight: 400 }}>-</span>}</td>
                  <td style={td}>{r.eligibleTier ? <span style={{ background: TIER_COLOR[r.eligibleTier], color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>Tier {r.eligibleTier}</span> : "-"}</td>
                  <td style={td}>
                    {done ? (
                      <span style={{ color: "#2e844a", fontWeight: 700 }}>→ {done}</span>
                    ) : options.length === 0 ? (
                      <span style={{ color: "#a0a0a0" }}>none free in tier</span>
                    ) : (
                      <select
                        defaultValue=""
                        disabled={busy === r.id}
                        onChange={(e) => {
                          const opt = options.find((o) => o.id === e.target.value);
                          if (opt) void assign(r, opt.id, opt.name);
                        }}
                        style={{ border: "1px solid #c9c9c9", borderRadius: 4, padding: "5px 8px", fontSize: 13 }}
                      >
                        <option value="" disabled>Pick a free closer...</option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>{o.name} (T{o.tier}, {o.closedCount} closed)</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
            {onCall.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>No agents on a call right now.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Recent handoffs - mark closed/lost */}
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700 }}>Recent handoffs (last 12h)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fronter</th>
              <th style={th}>Closer</th>
              <th style={th}>Client</th>
              <th style={th}>Debt</th>
              <th style={th}>Tier</th>
              <th style={th}>Status</th>
              <th style={th}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {handoffs.map((h) => (
              <tr key={h.id}>
                <td style={td}>{h.fronter ?? "-"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{h.closer ?? "-"}</td>
                <td style={td}>{h.clientName ?? "-"}</td>
                <td style={{ ...td, fontWeight: 700 }}>{h.debtLabel ?? "-"}</td>
                <td style={td}>{h.tier ? <span style={{ background: TIER_COLOR[h.tier], color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>T{h.tier}</span> : "-"}</td>
                <td style={td}>
                  <span style={{ fontWeight: 700, color: h.status === "CLOSED" ? "#2e844a" : h.status === "LOST" ? "#b3261e" : "#747474" }}>{h.status}</span>
                </td>
                <td style={td}>
                  {h.status === "ASSIGNED" ? (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <button disabled={busy === h.id} onClick={() => mark(h.id, "CLOSED")} style={{ background: "#2e844a", color: "#fff", border: 0, borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Closed</button>
                      <button disabled={busy === h.id} onClick={() => mark(h.id, "LOST")} style={{ background: "#fff", color: "#b3261e", border: "1px solid #e0b4b0", borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Lost</button>
                    </span>
                  ) : <span style={{ color: "#a0a0a0" }}>-</span>}
                </td>
              </tr>
            ))}
            {handoffs.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>No handoffs yet. Assign a closer from the live floor above.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Closer stats */}
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700 }}>Closer stats</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: "right" }}>Calls</th>
              <th style={{ ...th, textAlign: "right" }}>Debt attempted</th>
              <th style={{ ...th, textAlign: "right" }}>Closed</th>
              <th style={{ ...th, textAlign: "right" }}>Debt closed</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                <td style={td}>{s.tier ? <span style={{ background: TIER_COLOR[s.tier], color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>T{s.tier}</span> : "-"}</td>
                <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_DOT[s.state] }} />{s.free ? "Free" : s.state === "ON_CALL" ? "On call" : s.state === "NOT_READY" ? "Not ready" : "Offline"}</span></td>
                <td style={numTd}>{s.callsTaken}</td>
                <td style={numTd}>{s.debtAttempted ? money(s.debtAttempted) : "-"}</td>
                <td style={{ ...numTd, fontWeight: 700 }}>{s.closedCount}</td>
                <td style={numTd}>{s.debtClosed ? money(s.debtClosed) : "-"}</td>
              </tr>
            ))}
            {stats.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>No tiered closers. Assign tiers in Setup &gt; Closer Tiers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
