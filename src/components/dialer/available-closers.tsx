"use client";

import { useEffect, useState } from "react";

/**
 * Dialer window: the closers who are OPEN (Five9 READY) right now, grouped by
 * tier. This is all the fronter needs at transfer time - who is free and what
 * tier they are. Polls every 4s so it stays live.
 */

interface TierGroup {
  tier: number;
  closers: string[];
}

const TIER_COLOR: Record<number, string> = { 1: "#7f8de1", 2: "#0176d3", 3: "#2e844a" };

export function AvailableClosers({ showPopOut = false }: { showPopOut?: boolean }) {
  const [tiers, setTiers] = useState<TierGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/dialer/available-closers");
        if (r.ok && alive) setTiers((await r.json()).tiers ?? []);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    }
    void load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const totalFree = tiers.reduce((s, t) => s + t.closers.length, 0);

  return (
    <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden", minHeight: 600 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>Open closers</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#2e844a", fontWeight: 700 }}>{totalFree} free</span>
          {showPopOut && (
            <button
              onClick={() => window.open("/closers-window", "openClosers", "width=340,height=720")}
              title="Open in a separate window to dock next to Five9"
              style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#0176d3", cursor: "pointer" }}
            >
              Pop out ↗
            </button>
          )}
        </span>
      </div>

      {loading && <div style={{ padding: 16, fontSize: 12, color: "#747474" }}>Loading...</div>}

      {!loading && tiers.map((t) => (
        <div key={t.tier} style={{ padding: "10px 12px", borderBottom: "1px solid #f1f1f1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ background: TIER_COLOR[t.tier] ?? "#747474", color: "#fff", padding: "1px 7px", borderRadius: 9, fontSize: 11, fontWeight: 700 }}>Tier {t.tier}</span>
            <span style={{ fontSize: 11, color: "#a0a0a0" }}>{t.closers.length} free</span>
          </div>
          {t.closers.length === 0 ? (
            <div style={{ fontSize: 12, color: "#a0a0a0", paddingLeft: 2 }}>None available</div>
          ) : (
            t.closers.map((name) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 2px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#2e844a", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#181818" }}>{name}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </article>
  );
}
