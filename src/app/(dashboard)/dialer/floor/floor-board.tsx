"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveCall {
  five9UserId: string;
  username: string | null;
  callType: string | null;
  customer: string | null;
  campaignId: string | null;
  onCallSince: number | null;
  durationSec: number;
}

interface FloorData {
  connected: boolean;
  lastEventAgoMs: number | null;
  totalAgents: number;
  onCall: number;
  calls: LiveCall[];
}

function fmtDur(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, "0");
  const sss = String(ss).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

function direction(callType: string | null): { label: string; color: string } {
  if (callType === "INBOUND") return { label: "Inbound", color: "#2e844a" };
  if (callType === "AGENT" || callType === "MANUAL") return { label: "Manual", color: "#9050e9" };
  return { label: "Outbound", color: "#0176d3" };
}

/** Is the customer field a phone number (outbound) vs a contact name (inbound)? */
function isPhone(v: string | null): boolean {
  return !!v && /^[\d\s+()-]+$/.test(v) && v.replace(/\D/g, "").length >= 7;
}

export function FloorBoard() {
  const [data, setData] = useState<FloorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Poll the floor every 4s.
  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const r = await fetch("/api/dialer/floor");
        if (!active) return;
        if (r.ok) {
          setData(await r.json());
          setError(null);
        } else {
          setError(`Failed to load floor (${r.status})`);
        }
      } catch {
        if (active) setError("Network error");
      }
    }
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Tick the live durations every second between polls.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const calls = data?.calls ?? [];

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Live Floor</h1>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444444" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: data?.connected ? "#2e844a" : "#c23934", display: "inline-block" }} />
          {data?.connected ? "Feed connected" : "Feed offline"}
        </span>
        <span style={{ fontSize: 13, color: "#747474" }}>
          <strong style={{ color: "#181818" }}>{data?.onCall ?? 0}</strong> on call · {data?.totalAgents ?? 0} agents tracked
        </span>
        <Link href="/dialer" style={{ marginLeft: "auto", color: "#0176d3", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Back to dialer
        </Link>
      </div>

      {error && <div style={{ color: "#c23934", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {!error && calls.length === 0 && (
        <div style={{ color: "#747474", padding: 48, textAlign: "center", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6 }}>
          No agents are on a call right now. Active calls will appear here automatically.
        </div>
      )}

      {/* Call grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {calls.map((c) => {
          const dir = direction(c.callType);
          const liveDur = c.onCallSince ? Math.max(0, Math.floor((now - c.onCallSince) / 1000)) : c.durationSec;
          const phone = isPhone(c.customer);
          return (
            <article key={c.five9UserId} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: dir.color, padding: "2px 8px", borderRadius: 10 }}>
                  {dir.label}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#181818" }}>{fmtDur(liveDur)}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#181818", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.username ?? c.five9UserId}
              </div>
              <div style={{ fontSize: 13, color: "#444444" }}>
                {phone ? "☎ " : "👤 "}
                {c.customer ?? "—"}
              </div>
              {c.campaignId && c.campaignId !== "0" && (
                <div style={{ fontSize: 11, color: "#747474", marginTop: 4 }}>Campaign {c.campaignId}</div>
              )}
              {/* Live transcript placeholder — wired once the transcription path is chosen. */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ecebea", fontSize: 12, color: "#a8a8a8", fontStyle: "italic" }}>
                Live transcript — coming soon
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
