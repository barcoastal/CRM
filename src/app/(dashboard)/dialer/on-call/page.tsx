"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Row {
  id: string;
  name: string;
  tier: number | null;
  durationSec: number;
  clientName: string | null;
  clientDebt: number | null;
  clientDebtLabel: string | null;
  leadId: string | null;
}
const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TIER_COLOR: Record<number, string> = { 1: "#7f8de1", 2: "#0176d3", 3: "#2e844a" };

export default function ClosersOnCallPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/dialer/closers-on-call");
        if (r.ok && alive) setRows((await r.json()).rows ?? []);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    }
    void load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Closers On Call</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Every agent on a live call and the debt size of the client they are talking with (tier badged for assigned closers). {rows.length} on call now · updates every 5s.
        </p>
      </header>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Closer</th>
              <th style={th}>Tier</th>
              <th style={th}>Client</th>
              <th style={{ ...th, textAlign: "right" }}>Client debt</th>
              <th style={{ ...th, textAlign: "right" }}>On call</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b3261e" }} />
                    {r.name}
                  </span>
                </td>
                <td style={td}>
                  {r.tier ? (
                    <span style={{ background: TIER_COLOR[r.tier] ?? "#747474", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Tier {r.tier}</span>
                  ) : "-"}
                </td>
                <td style={td}>
                  {r.leadId ? (
                    <Link href={`/leads/${r.leadId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{r.clientName ?? "Unknown"}</Link>
                  ) : (r.clientName ?? <span style={{ color: "#a0a0a0" }}>No match</span>)}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.clientDebtLabel ?? <span style={{ color: "#a0a0a0", fontWeight: 400 }}>-</span>}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#747474" }}>{dur(r.durationSec)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#747474", padding: 24 }}>No agents are on a call right now.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#747474", padding: 24 }}>Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
