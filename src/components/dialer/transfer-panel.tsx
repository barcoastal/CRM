"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Smart-transfer helper. When a fronter is on a call and wants to transfer,
 * this shows which closer tier the deal qualifies for (by debt) and which
 * closers in that tier are free right now (Five9 READY) to conference in.
 * Advisory only - the actual conference is made in the Five9 agent desktop.
 */

interface CloserAvailability {
  id: string;
  name: string;
  tier: number;
  state: "READY" | "ON_CALL" | "NOT_READY" | "OFFLINE";
  free: boolean;
}
interface TargetsResponse {
  debt: number;
  preferredTier: number;
  tiers: { tier: number; preferred: boolean; closers: CloserAvailability[] }[];
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const STATE_STYLE: Record<CloserAvailability["state"], { dot: string; label: string }> = {
  READY: { dot: "#2e844a", label: "Free" },
  ON_CALL: { dot: "#b3261e", label: "On call" },
  NOT_READY: { dot: "#fe9339", label: "Not ready" },
  OFFLINE: { dot: "#c9c9c9", label: "Offline" },
};

export function TransferPanel({
  leadId,
  onClose,
  maxHeight = 320,
}: {
  leadId: string | null;
  onClose?: () => void;
  maxHeight?: number;
}) {
  const [data, setData] = useState<TargetsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const qs = leadId ? `leadId=${encodeURIComponent(leadId)}` : "debt=0";
      const r = await fetch(`/api/dialer/transfer-targets?${qs}`);
      if (r.ok) setData(await r.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Poll so availability stays live while the panel is open.
  useEffect(() => {
    void load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const freeInPreferred = data?.tiers.find((t) => t.preferred)?.closers.some((c) => c.free);

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "10px 12px", maxHeight, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#181818" }}>
          Transfer routing
          {data && (
            <span style={{ fontWeight: 400, color: "#747474", marginLeft: 6 }}>
              {money(data.debt)} debt · Tier {data.preferredTier}
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: 0, color: "#747474", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>

      {loading && <div style={{ fontSize: 12, color: "#747474" }}>Checking who is free...</div>}

      {data && !freeInPreferred && (
        <div style={{ fontSize: 11, color: "#8e1f0b", background: "#fbeae5", border: "1px solid #f3cfc4", borderRadius: 4, padding: "5px 8px", marginBottom: 8 }}>
          No Tier {data.preferredTier} closer is free - fallback tiers shown below.
        </div>
      )}

      {data?.tiers.map((t) => (
        <div key={t.tier} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: t.preferred ? "#0176d3" : "#747474", marginBottom: 4 }}>
            Tier {t.tier}{t.preferred ? " · preferred" : " · fallback"}
          </div>
          {t.closers.length === 0 && <div style={{ fontSize: 12, color: "#a0a0a0", paddingLeft: 2 }}>No closers assigned.</div>}
          {t.closers.map((c) => {
            const s = STATE_STYLE[c.state];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", opacity: c.free ? 1 : 0.6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: c.free ? 700 : 400, color: "#181818", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span style={{ fontSize: 11, color: s.dot === "#c9c9c9" ? "#a0a0a0" : s.dot, fontWeight: 600 }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ fontSize: 10, color: "#a0a0a0", marginTop: 4 }}>
        Conference the free closer in from your Five9 desktop.
      </div>
    </div>
  );
}
