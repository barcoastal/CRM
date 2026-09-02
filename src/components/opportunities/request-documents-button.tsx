"use client";

import { useState } from "react";

const COPY = {
  DOCUMENTS: {
    button: "Request Documents",
    title: "Request Documents",
    blurb: "Emails a secure upload link. Files the client uploads are filed on this Opportunity and its Account.",
    placeholder: "e.g. Please upload your last 3 months of bank statements and your loan agreement.",
  },
  INFO: {
    button: "Request Info",
    title: "Request Info",
    blurb: "Emails a secure link asking the client for their mailing address and contact details. What they submit is saved on the Account and logged on this Opportunity.",
    placeholder: "e.g. Please confirm your current mailing address and best contact number.",
  },
} as const;

const INFO_FIELD_OPTIONS = [
  { key: "address", label: "Full address + phone/email" },
  { key: "ssn", label: "Social Security Number" },
  { key: "ein", label: "EIN / TIN" },
  { key: "dob", label: "Date of birth" },
  { key: "debts", label: "Debt info (lender + amount)" },
  { key: "bank", label: "Bank details (routing + account)" },
] as const;

export function RequestDocumentsButton({
  opportunityId,
  endpoint,
  defaultEmail,
  defaultName,
  kind = "DOCUMENTS",
}: {
  opportunityId?: string;
  endpoint?: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
  kind?: "DOCUMENTS" | "INFO";
}) {
  const postUrl = endpoint ?? `/api/opportunities/${opportunityId}/document-requests`;
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<string[]>(["address"]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; url?: string; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: email,
          recipientName: name,
          message,
          kind,
          requestedFields: kind === "INFO" ? fields : undefined,
        }),
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
        {copy.button}
      </button>

      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#181818" }}>{copy.title}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#747474" }}>{copy.blurb}</p>

            {kind === "INFO" && (
              <>
                <label style={label}>What do you need from the client?</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 12 }}>
                  {INFO_FIELD_OPTIONS.map((o) => (
                    <label
                      key={o.key}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#181818", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(o.key)}
                        onChange={(e) =>
                          setFields((prev) =>
                            e.target.checked ? [...prev, o.key] : prev.filter((k) => k !== o.key),
                          )
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </>
            )}

            <label style={label}>Recipient email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} type="email" />

            <label style={label}>Recipient name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

            <label style={label}>Note (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={copy.placeholder}
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
                  <div style={{ marginTop: 6, wordBreak: "break-all", color: "#0176d3" }}>{result.url}</div>
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
  color: "#444444",
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
  color: "#444444",
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
