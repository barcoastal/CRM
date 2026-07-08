"use client";

import { useEffect, useState } from "react";

/**
 * Send Packet modal (Opportunity page). Shows the auto-routed packet
 * (Coastal + processor + legal), collects signer name/email, and sends the
 * merged, filled, anchor-detected packet as one envelope via
 * /api/contracts/packet/send. Client signs the whole packet once.
 */
export function SendPacketModal({
  opportunityId,
  defaultSigner,
  open,
  onClose,
}: {
  opportunityId: string;
  defaultSigner?: { name?: string | null; email?: string | null };
  open: boolean;
  onClose: () => void;
}) {
  const [signerName, setSignerName] = useState(defaultSigner?.name ?? "");
  const [signerEmail, setSignerEmail] = useState(defaultSigner?.email ?? "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ packet: string; pages: number; signatureCount: number; signingUrl: string; emailSent: boolean; skipped?: string[] } | null>(null);

  useEffect(() => {
    setSignerName(defaultSigner?.name ?? "");
    setSignerEmail(defaultSigner?.email ?? "");
  }, [defaultSigner?.name, defaultSigner?.email, open]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setErr(null);
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  async function send() {
    if (!signerName.trim() || !signerEmail.trim()) {
      setErr("Signer name and email are required.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const res = await fetch("/api/contracts/packet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, signerName: signerName.trim(), signerEmail: signerEmail.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.details || `HTTP ${res.status}`);
      setResult(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Send Contract Packet</h2>
          <button onClick={onClose} style={{ border: 0, background: "none", fontSize: 18, cursor: "pointer", color: "#747474" }}>
            ×
          </button>
        </div>

        {result ? (
          <div style={{ fontSize: 13 }}>
            <div style={{ color: "#2e844a", fontWeight: 600, marginBottom: 8 }}>
              Sent: {result.packet}
            </div>
            <div style={{ color: "#444", marginBottom: 8 }}>
              {result.pages} pages · {result.signatureCount} signature spot(s) · email {result.emailSent ? "sent" : "FAILED"}
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <div style={{ color: "#8a6d00", background: "#fff8e1", borderRadius: 4, padding: "6px 10px", fontSize: 12, marginBottom: 8 }}>
                Not included (not uploaded yet): {result.skipped.join(", ")}
              </div>
            )}
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Signing link:</div>
            <a href={result.signingUrl} target="_blank" rel="noreferrer" style={{ color: "#0176d3", wordBreak: "break-all" }}>
              {result.signingUrl}
            </a>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button onClick={onClose} style={primaryBtn}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#747474", marginBottom: 12 }}>
              Auto-routes <strong>Coastal + processor (SAS/RAM) + legal (Citadel/Victory)</strong>, fills every field from
              this deal&apos;s calculator, merges into one PDF, and emails the signer a single link to sign all agreements
              at once.
            </p>
            <label style={label}>
              Signer name
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={input} />
            </label>
            <label style={label}>
              Signer email
              <input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} style={input} />
            </label>
            {err && <div style={{ color: "#c23934", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ marginTop: 16, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={btn}>Cancel</button>
              <button onClick={send} disabled={sending} style={{ ...primaryBtn, opacity: sending ? 0.6 : 1, cursor: sending ? "wait" : "pointer" }}>
                {sending ? "Sending…" : "Generate & Send Packet"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const panel: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: 460,
  maxWidth: "90vw",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#444" };
const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 34,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  marginTop: 4,
};
const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "7px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = { ...btn, background: "#2e844a", color: "#fff", borderColor: "#2e844a" };
