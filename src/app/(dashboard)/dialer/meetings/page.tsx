"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface MeetingRow {
  id: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  debt: number | null;
  debtLabel: string | null;
  tier: number | null;
  requestedAt: string | null;
  status: string;
  closerName: string | null;
  opportunityId: string | null;
  leadId: string | null;
}
interface CloserRow { id: string; name: string; tier: number | null }

const TIER_COLOR: Record<number, string> = { 1: "#7f8de1", 2: "#0176d3", 3: "#2e844a" };
const STATUS_COLOR: Record<string, string> = { REQUESTED: "#fe9339", ASSIGNED: "#0176d3", DONE: "#2e844a", CANCELED: "#b3261e" };

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "-";

export default function MeetingsPage() {
  const [upcoming, setUpcoming] = useState<MeetingRow[]>([]);
  const [past, setPast] = useState<MeetingRow[]>([]);
  const [closers, setClosers] = useState<CloserRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        fetch("/api/dialer/meetings").then((r) => (r.ok ? r.json() : { upcoming: [], past: [] })),
        fetch("/api/dialer/closer-stats").then((r) => (r.ok ? r.json() : { rows: [] })),
      ]);
      setUpcoming(m.upcoming ?? []);
      setPast(m.past ?? []);
      setClosers((c.rows ?? []).map((s: CloserRow) => ({ id: s.id, name: s.name, tier: s.tier })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function assign(callId: string, closerId: string) {
    setBusy(callId);
    try {
      await fetch("/api/dialer/scheduled-calls/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: callId, closerId }) });
      await load();
    } finally { setBusy(null); }
  }

  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#444", borderBottom: "1px solid #e5e5e5" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f1f1" };

  const tierBadge = (t: number | null) => t ? <span style={{ background: TIER_COLOR[t], color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>Tier {t}</span> : "-";
  const statusBadge = (s: string) => <span style={{ color: STATUS_COLOR[s] ?? "#747474", fontWeight: 700, fontSize: 12 }}>{s}</span>;
  const clientCell = (m: MeetingRow) => m.opportunityId
    ? <Link href={`/opportunities/${m.opportunityId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{m.clientName ?? "?"}</Link>
    : m.leadId ? <Link href={`/leads/${m.leadId}`} style={{ color: "#0176d3", textDecoration: "none" }}>{m.clientName ?? "?"}</Link>
    : (m.clientName ?? "?");

  const table = (rows: MeetingRow[], showAssign: boolean, emptyMsg: string) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>When</th>
          <th style={th}>Client</th>
          <th style={th}>Contact</th>
          <th style={th}>Debt</th>
          <th style={th}>Tier</th>
          <th style={th}>Closer</th>
          <th style={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const opts = m.tier ? closers.filter((o) => o.tier === m.tier) : closers;
          return (
            <tr key={m.id}>
              <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtWhen(m.requestedAt)}</td>
              <td style={td}>{clientCell(m)}</td>
              <td style={{ ...td, color: "#555" }}>{m.clientEmail ?? m.clientPhone ?? "-"}</td>
              <td style={{ ...td, fontWeight: 700 }}>{m.debtLabel ?? "-"}</td>
              <td style={td}>{tierBadge(m.tier)}</td>
              <td style={td}>
                {m.closerName ? (
                  <span style={{ color: "#2e844a", fontWeight: 700 }}>{m.closerName}</span>
                ) : showAssign && m.status === "REQUESTED" ? (
                  <select defaultValue="" disabled={busy === m.id} onChange={(e) => { if (e.target.value) void assign(m.id, e.target.value); }}
                    style={{ border: "1px solid #c9c9c9", borderRadius: 4, padding: "5px 8px", fontSize: 13 }}>
                    <option value="" disabled>Assign a closer...</option>
                    {opts.map((o) => <option key={o.id} value={o.id}>{o.name} (T{o.tier})</option>)}
                  </select>
                ) : <span style={{ color: "#a0a0a0" }}>-</span>}
              </td>
              <td style={td}>{statusBadge(m.status)}</td>
            </tr>
          );
        })}
        {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#747474", padding: 20 }}>{emptyMsg}</td></tr>}
      </tbody>
    </table>
  );

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Meetings</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Every call clients booked through the scheduling link. Assign a closer to the upcoming ones.
        </p>
      </header>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700 }}>Upcoming <span style={{ fontWeight: 400, color: "#747474", fontSize: 12 }}>· {upcoming.length}</span></div>
        {table(upcoming, true, "No upcoming meetings. Bookings from your scheduling link appear here.")}
      </div>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700 }}>Past <span style={{ fontWeight: 400, color: "#747474", fontSize: 12 }}>· {past.length}</span></div>
        {table(past, false, "No past meetings yet.")}
      </div>
    </div>
  );
}
