"use client";

import { useEffect, useState } from "react";
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
 * Five9 Agent Desktop embedded via iframe. Left pane shows the lead
 * context auto-loaded by phone when Five9 posts a callConnected event;
 * right pane hosts the full Five9 Agent Desktop the rep already uses.
 *
 * Five9 publishes a postMessage API for the iframed Agent Desktop —
 * events arrive as { type: "five9.callConnected", payload: { ani, dnis, ... } }.
 */
export function Five9Client({ five9Domain, defaultStation: _defaultStation }: Props) {
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);

  const iframeSrc = five9Domain ? `https://${five9Domain}/` : null;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!five9Domain) return;
      if (!event.origin.includes(five9Domain) && !event.origin.includes("five9.com")) return;
      const data = event.data as { type?: string; payload?: Record<string, unknown> } | undefined;
      if (!data || typeof data !== "object") return;
      if (data.type === "five9.callConnected" || data.type === "callConnected") {
        const payload = data.payload ?? {};
        const phone =
          (payload.ani as string) ??
          (payload.dnis as string) ??
          (payload.phoneNumber as string) ??
          null;
        if (phone) void handlePhoneChange(phone);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [five9Domain]);

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

      {/* Five9 dialer panel — right (custom CTI in progress) */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 24, minHeight: 600 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#3e3e3c", marginBottom: 12 }}>
            Five9 Dialer
          </h3>
          <div style={{ background: "#f3f3f3", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#3e3e3c", margin: 0, marginBottom: 8 }}>
              <strong>Custom dialer in build.</strong> Five9 blocks embedding their Agent Desktop in
              a third-party iframe, so we&apos;re building a native panel on the Five9 REST API
              with click-to-dial, hold, answer, transfer, and disposition.
            </p>
            <p style={{ fontSize: 12, color: "#706e6b", margin: 0 }}>
              In the meantime, use the Five9 Agent Desktop in a separate tab. Calls placed there
              still flow through our webhook → Call records + lead disposition pipeline.
            </p>
          </div>
          {iframeSrc && (
            <a
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                background: "#0070d2",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open Five9 Agent Desktop ↗
            </a>
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
