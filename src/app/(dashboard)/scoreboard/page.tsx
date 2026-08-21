"use client";

import { useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  tier: number | null;
  state: "READY" | "ON_CALL" | "NOT_READY" | "OFFLINE";
  free: boolean;
  assignedCount: number;
  wonCount: number;
  wonDebt: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const STATE: Record<Row["state"], { dot: string; label: string }> = {
  READY: { dot: "#2e844a", label: "Free" },
  ON_CALL: { dot: "#b3261e", label: "On call" },
  NOT_READY: { dot: "#fe9339", label: "Not ready" },
  OFFLINE: { dot: "#c9c9c9", label: "Offline" },
};

export default function ScoreboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/scoreboard");
        if (r.ok && alive) setRows((await r.json()).rows ?? []);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    }
    void load();
    const id = setInterval(load, 8000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const freeNow = rows.filter((r) => r.free).length;

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Closer Scoreboard</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Live closer availability and production. {freeNow} free right now · updates every 8s.
        </p>
      </header>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40 }}>#</th>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: "right" }}>Won</th>
              <th style={{ ...th, textAlign: "right" }}>Won debt</th>
              <th style={{ ...th, textAlign: "right" }}>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = STATE[r.state];
              return (
                <tr key={r.id}>
                  <td style={{ ...td, color: "#a0a0a0" }}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                  <td style={td}>{r.tier ? `Tier ${r.tier}` : <span style={{ color: "#a0a0a0" }}>-</span>}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot }} />
                      <span style={{ color: s.dot === "#c9c9c9" ? "#a0a0a0" : s.dot, fontWeight: 600, fontSize: 12 }}>{s.label}</span>
                    </span>
                  </td>
                  <td style={{ ...num, fontWeight: 700 }}>{r.wonCount}</td>
                  <td style={num}>{money(r.wonDebt)}</td>
                  <td style={{ ...num, color: "#747474" }}>{r.assignedCount}</td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>No closers yet. Assign tiers in Setup &gt; Closer Tiers.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
