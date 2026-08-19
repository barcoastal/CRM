"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Get Quote: emails the client a branded savings quote built from the opp's
 * real numbers. The modal previews the figures (savings, payment, term) so
 * the agent sees exactly what the client will get before sending.
 */

interface Figures {
  enrolledDebt: number;
  programCost: number;
  youSave: number;
  savingsPercent: number;
  weeklyPayment: number;
  monthlyPayment: number;
  programMonths: number;
  weeklySaving: number | null;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function GetQuoteModal({
  opportunityId,
  open,
  onClose,
}: {
  opportunityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSent(false);
    setError(null);
    fetch(`/api/opportunities/${opportunityId}/quote`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { figures: Figures; recipientEmail: string | null; recipientName: string | null }) => {
        setFigures(d.figures);
        setEmail(d.recipientEmail ?? "");
        setName(d.recipientName ?? "");
      })
      .catch(() => setError("Could not load the quote figures."))
      .finally(() => setLoading(false));
  }, [open, opportunityId]);

  async function send() {
    if (!email.trim()) {
      setError("A recipient email is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email, recipientName: name, note }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; sentTo?: string };
      if (!res.ok) {
        setError(d.error ?? "Could not send the quote.");
        return;
      }
      toast.success(`Quote sent to ${d.sentTo}`);
      setSent(true);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const row = (label: string, value: string, strong = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #f3f3f3",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#444" }}>{label}</span>
      <span style={{ color: "#181818", fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  );

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#181818", flex: 1 }}>Get Quote</h2>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 18, color: "#747474", cursor: "pointer" }}>
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#747474" }}>
          Emails the client a branded savings quote with payments, our BBB A+ rating, and client testimonials.
        </p>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#747474" }}>Loading figures…</div>
        ) : sent ? (
          <div
            style={{
              padding: "12px 14px",
              background: "#eaf5ec",
              border: "1px solid #b7e1c2",
              borderRadius: 6,
              fontSize: 13,
              color: "#2e844a",
            }}
          >
            Quote sent to {email}. It is logged on the opportunity activity.
          </div>
        ) : (
          <>
            {figures && (
              <div
                style={{
                  background: "linear-gradient(135deg,#1B96FF,#0B5CAB)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 12,
                  textAlign: "center",
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#cfe4ff" }}>
                  Estimated total savings
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, margin: "2px 0" }}>{money(figures.youSave)}</div>
                <div style={{ fontSize: 13, color: "#eaf3ff" }}>about {figures.savingsPercent}% off the enrolled debt</div>
              </div>
            )}

            {figures && (
              <div style={{ marginBottom: 14 }}>
                {row("Enrolled debt today", money(figures.enrolledDebt))}
                {row("Estimated program cost", money(figures.programCost))}
                {row("Estimated weekly payment", money(figures.weeklyPayment))}
                {row("Estimated monthly payment", money(figures.monthlyPayment))}
                {row("Program length", `${figures.programMonths} months`)}
                {figures.weeklySaving != null && figures.weeklySaving > 0
                  ? row("Weekly saving vs now", money(figures.weeklySaving), true)
                  : null}
              </div>
            )}

            <label style={label}>Recipient email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} type="email" />

            <label style={label}>Recipient name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

            <label style={label}>Personal note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Great speaking with you today — here is what we discussed."
              style={{ ...input, height: "auto", padding: 8, resize: "vertical" }}
            />

            {error && <div style={{ margin: "0 0 10px", fontSize: 13, color: "#c23934" }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} disabled={busy} style={btnGhost}>
                Cancel
              </button>
              <button onClick={send} disabled={busy || !figures} style={btn}>
                {busy ? "Sending…" : "Send Quote"}
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
  background: "rgba(8,7,7,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 460,
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#444", margin: "0 0 4px" };
const input: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 12,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  background: "#0176d3",
  border: "none",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#444",
  cursor: "pointer",
};
