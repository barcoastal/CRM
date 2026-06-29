"use client";

import { useState } from "react";

export function RequestDocumentsButton({
  opportunityId,
  defaultEmail,
  defaultName,
}: {
  opportunityId: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; url?: string; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email, recipientName: name, message }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        emailed?: boolean;
        emailError?: string;
      };
      if (!res.ok) {
        setResult({ ok: false, text: data.error ?? "Could not create the request." });
      } else if (data.emailed) {
        setResult({ ok: true, url: data.url, text: `Link emailed to ${email}.` });
      } else {
        setResult({
          ok: true,
          url: data.url,
          text: `Link created, but the email did not send (${data.emailError ?? "unknown"}). Copy the link below and send it manually.`,
        });
      }
    } catch {
      setResult({ ok: false, text: "Network error, please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={btn}>
        Request Documents
      </button>

      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#080707" }}>Request Documents</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#706e6b" }}>
              Emails a secure upload link. Files the client uploads are filed on this Opportunity and
              its Account.
            </p>

            <label style={label}>Recipient email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} type="email" />

            <label style={label}>Recipient name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

            <label style={label}>Note (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g. Please upload your last 3 months of bank statements and your loan agreement."
              style={{ ...input, height: "auto", padding: 8, resize: "vertical" }}
            />

            {result && (
              <div
                style={{
                  margin: "4px 0 12px",
                  padding: "8px 12px",
                  borderRadius: 4,
                  fontSize: 13,
                  background: result.ok ? "#eaf5ec" : "#fdecea",
                  color: result.ok ? "#2e844a" : "#c23934",
                  border: `1px solid ${result.ok ? "#b7e1c2" : "#f5c2c0"}`,
                }}
              >
                <div>{result.text}</div>
                {result.url && (
                  <div style={{ marginTop: 6, wordBreak: "break-all", color: "#0070d2" }}>{result.url}</div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={() => setOpen(false)} disabled={busy} style={btnGhost}>
                {result?.ok ? "Close" : "Cancel"}
              </button>
              <button onClick={send} disabled={busy || !email} style={btn}>
                {busy ? "Sending..." : result?.ok ? "Send another" : "Send link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btn: React.CSSProperties = {
  background: "#0070d2",
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
  border: "1px solid #d8dde6",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#3e3e3c",
  cursor: "pointer",
};
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
  padding: 24,
  width: "100%",
  maxWidth: 460,
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  margin: "0 0 4px",
};
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
