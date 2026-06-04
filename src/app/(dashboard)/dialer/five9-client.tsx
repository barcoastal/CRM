"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface LeadContext {
  id: string;
  contactName: string;
  businessName: string;
  phone: string;
  email: string | null;
  status: string;
  totalDebtEst: number | null;
  industry: string | null;
  lastContactedAt: string | null;
  recentCalls: Array<{ id: string; startedAt: string; disposition: string | null; duration: number | null }>;
}

interface Props {
  five9Domain: string | null;
  defaultStation: string | null;
}

/**
 * Five9 Embedded Agent client. Loads Five9's embedded.js widget into a
 * div on the right side of the dialer page; left side shows the lead
 * context auto-loaded by phone when a call connects.
 *
 * Five9 widget docs vary by tenant — common loader URL:
 *   https://<domain>.five9.com/embedded/embedded.js
 *
 * The widget exposes window.Five9 events. We listen for callConnected /
 * dispositionSaved to load the lead and mirror dispositions.
 */
export function Five9Client({ five9Domain, defaultStation }: Props) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [widgetState, setWidgetState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!five9Domain) {
      setWidgetState("error");
      return;
    }
    setWidgetState("loading");
    const script = document.createElement("script");
    script.src = `https://${five9Domain}/embedded/embedded.js`;
    script.async = true;
    script.onload = () => {
      // Initialize Five9 with the mount point + default station
      const w = window as unknown as { Five9?: { init?: (cfg: Record<string, unknown>) => void; on?: (event: string, fn: (data: Record<string, unknown>) => void) => void } };
      try {
        if (w.Five9?.init && widgetRef.current) {
          w.Five9.init({
            container: widgetRef.current,
            domain: five9Domain,
            station: defaultStation ?? undefined,
          });
          // Subscribe to lifecycle events
          w.Five9.on?.("callConnected", (data) => {
            const phone = (data.ani as string) ?? (data.dnis as string) ?? (data.phoneNumber as string) ?? null;
            if (phone) handlePhoneChange(phone);
          });
          w.Five9.on?.("dispositionSaved", (data) => {
            void handleDispositionSaved(data);
          });
          setWidgetState("ready");
        } else {
          setWidgetState("error");
        }
      } catch (e) {
        console.error("Five9 init failed", e);
        setWidgetState("error");
      }
    };
    script.onerror = () => setWidgetState("error");
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [five9Domain, defaultStation]);

  async function handlePhoneChange(phone: string) {
    setCurrentPhone(phone);
    setLoadingLead(true);
    try {
      const last10 = phone.replace(/[^0-9]/g, "").slice(-10);
      const res = await fetch(`/api/leads/by-phone?phone=${encodeURIComponent(last10)}`);
      if (res.ok) {
        const data = await res.json();
        setLead(data ?? null);
      }
    } finally {
      setLoadingLead(false);
    }
  }

  async function handleDispositionSaved(data: Record<string, unknown>) {
    // Mirror Five9 disposition into our CRM disposition flow if we have a lead
    if (!lead) return;
    const disposition = (data.disposition as string) ?? (data.dispositionName as string) ?? null;
    if (!disposition) return;
    // We rely on the webhook for the canonical write; this is just a UI sync hint.
    // If you want immediate UI: refetch the lead.
    handlePhoneChange(lead.phone);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 12, padding: 12 }}>
      {/* Lead context — left */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, minHeight: 600 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#3e3e3c", marginBottom: 12 }}>
            Lead Context
          </h2>
          {loadingLead && <div style={{ color: "#706e6b" }}>Loading lead…</div>}
          {!loadingLead && !lead && !currentPhone && (
            <div style={{ color: "#706e6b", padding: 24, textAlign: "center" }}>
              No active call. When Five9 connects a call, the matching lead loads here automatically.
            </div>
          )}
          {!loadingLead && !lead && currentPhone && (
            <div style={{ color: "#c23934", padding: 16 }}>
              No matching lead found for <strong>{currentPhone}</strong>.
            </div>
          )}
          {lead && <LeadCard lead={lead} />}
        </article>
      </div>

      {/* Five9 widget — right */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 0, minHeight: 600, overflow: "hidden" }}>
          {widgetState === "error" && (
            <div style={{ padding: 24, color: "#c23934", textAlign: "center" }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Five9 widget not available</h3>
              <p style={{ fontSize: 13 }}>
                Make sure you&apos;ve set <code>NEXT_PUBLIC_FIVE9_DOMAIN</code> on Railway and that the
                Embedded Agent feature is enabled in your Five9 tenant.
              </p>
            </div>
          )}
          {widgetState !== "error" && (
            <div ref={widgetRef} id="five9-widget" style={{ width: "100%", minHeight: 600 }}>
              {widgetState !== "ready" && (
                <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>Loading Five9…</div>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadContext }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lead.contactName}</h3>
        <div style={{ color: "#706e6b", fontSize: 13 }}>{lead.businessName}</div>
      </div>
      <Grid
        cells={[
          ["Phone", lead.phone],
          ["Email", lead.email ?? "—"],
          ["Status", lead.status],
          ["Industry", lead.industry ?? "—"],
          ["Est. Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : "—"],
          ["Last contact", lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"],
        ]}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Link
          href={`/leads/${lead.id}`}
          target="_blank"
          style={{
            background: "#0070d2",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open in Leads ↗
        </Link>
      </div>

      {lead.recentCalls.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recent Calls</h4>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ecebea" }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>When</th>
                <th style={{ textAlign: "left", padding: "4px 0" }}>Disposition</th>
                <th style={{ textAlign: "right", padding: "4px 0" }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {lead.recentCalls.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: "4px 0" }}>{new Date(c.startedAt).toLocaleString()}</td>
                  <td style={{ padding: "4px 0" }}>{c.disposition ?? "—"}</td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>
                    {c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, "0")}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Grid({ cells }: { cells: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", fontSize: 13 }}>
      {cells.map(([k, v]) => (
        <div key={k}>
          <div style={{ color: "#706e6b", fontSize: 11, marginBottom: 2 }}>{k}</div>
          <div style={{ color: "#080707", fontWeight: 600 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
