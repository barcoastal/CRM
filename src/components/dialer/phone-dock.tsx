"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Persistent Five9 softphone dock. Rendered in the dashboard layout so it stays
 * mounted (and the call stays connected) while the user navigates the entire
 * CRM. This is the closer workspace: phone pinned bottom-right, full CRM behind
 * it. Opt-in via the launcher; once opened the iframe persists for the session
 * (collapsing only clips it, so the call never drops).
 */

const FIVE9_SRC = "https://app-atl.five9.com/clients/agent/main.html?role=Agent";

interface ActiveCall {
  active?: boolean;
  phone?: string;
  customer?: string;
  callType?: string;
  leadId?: string | null;
  onCallSince?: number;
}

export function PhoneDock() {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false); // iframe mounted (= logged-in / available)
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [now, setNow] = useState(0);
  const lastSinceRef = useRef<number | null>(null);
  const [poppedLeadId, setPoppedLeadId] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    setNow(Date.now());
    try {
      if (localStorage.getItem("phoneDockOpen") === "1") setOpen(true);
      const ex = localStorage.getItem("phoneDockExpanded");
      if (ex !== null) setExpanded(ex === "1");
      if (localStorage.getItem("phoneDockMax") === "1") setMaximized(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (hydrated) try { localStorage.setItem("phoneDockOpen", open ? "1" : "0"); } catch {}
  }, [open, hydrated]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem("phoneDockExpanded", expanded ? "1" : "0"); } catch {}
  }, [expanded, hydrated]);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem("phoneDockMax", maximized ? "1" : "0"); } catch {}
  }, [maximized, hydrated]);

  // Poll the agent's active call (screen-pop source) while the dock is open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/dialer/active-call");
        if (!r.ok || !alive) return;
        const data = (await r.json()) as ActiveCall;
        setCall(data);
        const since = data.active && typeof data.onCallSince === "number" ? data.onCallSince : null;
        if (since && since !== lastSinceRef.current) {
          // a new call connected → surface its lead
          lastSinceRef.current = since;
          setPoppedLeadId(data.leadId ?? null);
        } else if (!data.active) {
          lastSinceRef.current = null;
          setPoppedLeadId(null);
        } else if (data.leadId && !poppedLeadId) {
          setPoppedLeadId(data.leadId);
        }
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!hydrated) return null;
  // The /dialer page has its own full Five9 desktop; rendering the dock there
  // too would log the agent into Five9 twice and kick one session on connect.
  if (pathname?.startsWith("/dialer")) return null;

  const onCall = !!call?.active && !!call?.onCallSince;
  const durSec = onCall && call?.onCallSince ? Math.max(0, Math.floor((now - call.onCallSince) / 1000)) : 0;
  const durStr = `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 5000,
          background: "#0176d3", color: "#fff", border: "none", borderRadius: 24,
          padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.22)", display: "inline-flex", alignItems: "center", gap: 8,
        }}
      >
        <span aria-hidden>☎</span> Phone
      </button>
    );
  }

  const dockWidth = maximized ? "min(1100px, 96vw)" : 760;
  const bodyHeight = expanded ? (maximized ? "82vh" : 640) : 0;

  return (
    <div
      style={{
        position: "fixed", bottom: 0, right: 16, zIndex: 5000, width: dockWidth,
        background: "#fff", border: "1px solid #c9c9c9", borderBottom: "none",
        borderRadius: "8px 8px 0 0", overflow: "hidden",
        boxShadow: "0 -2px 18px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          background: onCall ? "#b3261e" : "#04254a", color: "#fff", userSelect: "none",
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: onCall ? "#fff" : "#4bca81", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{onCall ? `On call ${durStr}` : "Phone"}</span>
        {onCall && call?.customer && (
          <span style={{ fontSize: 12, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {call.customer}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 14, alignItems: "center" }}>
          <button onClick={() => setMaximized((m) => !m)} title={maximized ? "Restore" : "Maximize"}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, padding: 0 }}>
            {maximized ? "🗗 Restore" : "🗖 Bigger"}
          </button>
          <button onClick={() => setExpanded((e) => !e)} title={expanded ? "Hide" : "Show"}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, padding: 0 }}>
            {expanded ? "▾ Hide" : "▴ Show"}
          </button>
        </span>
      </div>

      {onCall && poppedLeadId && (
        <Link
          href={`/leads/${poppedLeadId}`}
          style={{
            display: "block", padding: "7px 12px", background: "#fff7d6",
            borderBottom: "1px solid #f2e9b8", fontSize: 12, color: "#0b5cab", fontWeight: 700, textDecoration: "none",
          }}
        >
          Open this lead to work it ↗
        </Link>
      )}
      {onCall && !poppedLeadId && call?.customer && (
        <div style={{ padding: "7px 12px", background: "#fbeae5", borderBottom: "1px solid #f3cfc4", fontSize: 12, color: "#8e1f0b" }}>
          No matching lead for {call.customer}
        </div>
      )}

      {/* Iframe stays mounted; collapsing only clips it so the call never drops. */}
      <div style={{ height: bodyHeight, overflow: "hidden", transition: "height 0.15s ease" }}>
        <iframe
          src={FIVE9_SRC}
          title="Five9 Phone"
          allow="microphone; autoplay; clipboard-read; clipboard-write"
          style={{ width: "100%", height: maximized ? "82vh" : 640, border: "none", display: "block", background: "#fff" }}
        />
      </div>
    </div>
  );
}
