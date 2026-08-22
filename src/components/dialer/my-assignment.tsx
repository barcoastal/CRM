"use client";

import { useEffect, useState } from "react";

/**
 * Fronter-side banner: once the floor manager assigns a closer to the fronter's
 * current lead, this shows "Transfer to [closer]" so they conference them in.
 * Polls /api/dialer/my-assignment.
 */
interface Assignment {
  id: string;
  closer: string | null;
  tier: number | null;
  clientName: string | null;
  debtLabel: string | null;
}

export function MyAssignment() {
  const [a, setA] = useState<Assignment | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/dialer/my-assignment");
        if (r.ok && alive) setA((await r.json()).assignment ?? null);
      } catch { /* ignore */ }
    }
    void load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Waiting for the floor manager to assign a closer.
  if (!a?.closer) {
    return (
      <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden", minHeight: 140 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 700, color: "#181818" }}>Your transfer</div>
        <div style={{ padding: 20, fontSize: 13, color: "#747474", textAlign: "center" }}>
          Waiting for the floor manager to assign a closer. When they do, the closer to transfer to shows here.
        </div>
      </article>
    );
  }
  return (
    <div style={{ background: "#0b5cab", color: "#fff", borderRadius: 4, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Transfer to</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{a.closer} {a.tier ? <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>· Tier {a.tier}</span> : null}</div>
      {a.debtLabel && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{a.clientName ?? ""} · {a.debtLabel}</div>}
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>Conference them in from your Five9 desktop.</div>
    </div>
  );
}
