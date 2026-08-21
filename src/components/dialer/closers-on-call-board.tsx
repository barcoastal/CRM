"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Live board of every agent on a call + the client's debt size. Used full-width
 * on /dialer/on-call and in a compact variant beside the Five9 iframe.
 */

export interface OnCallRow {
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

export function ClosersOnCallBoard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<OnCallRow[]>([]);
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

  const TierBadge = ({ tier }: { tier: number | null }) =>
    tier ? (
      <span style={{ background: TIER_COLOR[tier] ?? "#747474", color: "#fff", padding: "1px 6px", borderRadius: 9, fontSize: 10, fontWeight: 700 }}>T{tier}</span>
    ) : null;

  if (compact) {
    return (
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {loading && <div style={{ padding: 12, fontSize: 12, color: "#747474" }}>Loading...</div>}
        {!loading && rows.length === 0 && <div style={{ padding: 12, fontSize: 12, color: "#747474" }}>No agents on a call.</div>}
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid #f1f1f1" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#b3261e", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.name} <TierBadge tier={r.tier} />
              </div>
              <div style={{ fontSize: 11, color: "#747474", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.leadId ? <Link href={`/leads/${r.leadId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{r.clientName ?? "?"}</Link> : (r.clientName ?? "?")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.clientDebtLabel ? "#181818" : "#a0a0a0" }}>{r.clientDebtLabel ?? "-"}</div>
              <div style={{ fontSize: 10, color: "#a0a0a0" }}>{dur(r.durationSec)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };

  return (
    <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Agent</th>
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
              <td style={td}><TierBadge tier={r.tier} /></td>
              <td style={td}>
                {r.leadId ? <Link href={`/leads/${r.leadId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{r.clientName ?? "Unknown"}</Link> : (r.clientName ?? <span style={{ color: "#a0a0a0" }}>No match</span>)}
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
  );
}
