"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { NewEnvelopeModal } from "./new-envelope-modal";
import { SendContractModal } from "@/components/esign/send-contract-modal";

export type EnvelopeRow = {
  id: string;
  recordType: string;
  status: string;
  signerName: string;
  signerEmail: string;
  templateName: string | null;
  documentName: string;
  signingToken: string;
  sentAt: string | null;
  signedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT:     { bg: "#ecebea", color: "#444444" },
  SENT:      { bg: "#d4ecff", color: "#0a3b6f" },
  VIEWED:    { bg: "#fff5d8", color: "#806c00" },
  SIGNED:    { bg: "#ddf5d6", color: "#0b683b" },
  COMPLETED: { bg: "#ddf5d6", color: "#0b683b" },
  VOIDED:    { bg: "#feded2", color: "#8e1f0b" },
  DECLINED:  { bg: "#feded2", color: "#8e1f0b" },
};

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Engagement Agreement",
  BANK_CHANGE: "Bank Change Auth",
  DISCLOSURE: "Disclosure",
  AMENDMENT: "Amendment",
  OTHER: "Other",
};

export function EnvelopesRelatedList({
  envelopes,
  opportunityId,
  accountId,
  leadId,
  defaultSignerName,
  defaultSignerEmail,
  recommendedAgreement,
}: {
  envelopes: EnvelopeRow[];
  opportunityId?: string;
  accountId?: string;
  leadId?: string;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
  recommendedAgreement?: "Victory" | "Citadel" | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function copyLink(token: string) {
    const url = `${window.location.origin}/sign/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Signing link copied");
  }

  async function resend(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/envelopes/${id}/send`, { method: "POST" });
      if (res.ok) {
        toast.success("Envelope re-sent");
        router.refresh();
      } else {
        toast.error("Resend failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function voidEnv(id: string) {
    if (!confirm("Void this envelope?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/envelopes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VOIDED" }),
      });
      if (res.ok) {
        toast.success("Envelope voided");
        router.refresh();
      } else {
        toast.error("Void failed");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 8 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid #ecebea",
        }}
      >
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Envelopes ({envelopes.length})
        </h2>
        <div style={{ display: "flex", gap: 6 }}>
          {opportunityId && (
            <button
              onClick={() => setTemplateModal(true)}
              style={{
                background: "#fff",
                border: "1px solid #c9c9c9",
                color: "#0176d3",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New from Template
            </button>
          )}
          <button
            onClick={() => setModal(true)}
            style={{
              background: "#fff",
              border: "1px solid #c9c9c9",
              color: "#0176d3",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New Envelope
          </button>
        </div>
      </header>
      {envelopes.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: "#747474" }}>No envelopes yet.</div>
      ) : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
              <th style={th}>Document</th>
              <th style={th}>Type</th>
              <th style={th}>Signer</th>
              <th style={th}>Status</th>
              <th style={th}>Sent</th>
              <th style={th}>Signed</th>
              <th style={{ ...th, width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {envelopes.map((e) => {
              const tone = STATUS_COLORS[e.status] ?? STATUS_COLORS.DRAFT;
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={td}>{e.documentName}</td>
                  <td style={td}>{TYPE_LABELS[e.recordType] ?? e.recordType}</td>
                  <td style={td}>
                    <div>{e.signerName}</div>
                    <div style={{ fontSize: 11, color: "#747474" }}>{e.signerEmail}</div>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        background: tone.bg,
                        color: tone.color,
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td style={td}>{e.sentAt ? new Date(e.sentAt).toLocaleDateString() : "—"}</td>
                  <td style={td}>{e.completedAt ? new Date(e.completedAt).toLocaleDateString() : "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => copyLink(e.signingToken)} title="Copy signing link" style={iconBtn}>🔗</button>
                      {(e.status === "SENT" || e.status === "VIEWED") && (
                        <button onClick={() => resend(e.id)} disabled={busy === e.id} title="Resend" style={iconBtn}>↻</button>
                      )}
                      {e.status !== "COMPLETED" && e.status !== "VOIDED" && (
                        <button onClick={() => voidEnv(e.id)} disabled={busy === e.id} title="Void" style={{ ...iconBtn, color: "#c23934" }}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <NewEnvelopeModal
        open={modal}
        onClose={() => setModal(false)}
        opportunityId={opportunityId}
        accountId={accountId}
        leadId={leadId}
        defaultSignerName={defaultSignerName}
        defaultSignerEmail={defaultSignerEmail}
      />
      {opportunityId && (
        <SendContractModal
          opportunityId={opportunityId}
          defaultSigner={{ name: defaultSignerName ?? null, email: defaultSignerEmail ?? null }}
          recommendedAgreement={recommendedAgreement}
          open={templateModal}
          onClose={() => setTemplateModal(false)}
        />
      )}
    </article>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 11,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
};
const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  cursor: "pointer",
  color: "#0176d3",
  fontSize: 14,
  padding: 2,
};
