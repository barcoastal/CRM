"use client";

import { useEffect, useState } from "react";

/**
 * Header feedback widget: one click, three fields, auto-captures the page the
 * user is on. Doubles as the "my reports" status view so people see their
 * feedback goes somewhere.
 */

const TYPE_OPTIONS = [
  { value: "BUG", label: "Something is broken" },
  { value: "PARITY", label: "Looks different from Salesforce" },
  { value: "IDEA", label: "Idea / improvement" },
] as const;

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  NEW: { label: "New", bg: "#eef1f8", color: "#444444" },
  IN_PROGRESS: { label: "In progress", bg: "#fdf3e2", color: "#8c5f10" },
  DONE: { label: "Done", bg: "#eaf5ec", color: "#2e844a" },
  WONT_FIX: { label: "Closed", bg: "#f3f3f3", color: "#747474" },
};

interface MyReport {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("BUG");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyReport[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/feedback?mine=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMine(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [open, sent]);

  async function submit() {
    if (!message.trim()) {
      setError("Tell us what happened or what you want.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, pageUrl: window.location.href }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Could not send, please try again.");
        return;
      }
      setMessage("");
      setSent(true);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="sf-util-btn"
        title="Give feedback"
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
      >
        <svg className="sf-util-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#feed" />
        </svg>
      </button>

      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#181818" }}>Give feedback</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#747474" }}>
              Goes straight to the team with a link to the page you are on.
            </p>

            {sent ? (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#eaf5ec",
                  border: "1px solid #b7e1c2",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#2e844a",
                  marginBottom: 12,
                }}
              >
                Thank you, your feedback was sent.
              </div>
            ) : (
              <>
                <label style={label}>What kind of feedback?</label>
                <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...input, background: "#fff" }}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <label style={label}>What happened / what do you want?</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder={
                    type === "PARITY"
                      ? "e.g. In Salesforce this field shows on the left side"
                      : type === "BUG"
                      ? "e.g. Clicking Save on this page shows an error"
                      : "e.g. It would save time if..."
                  }
                  style={{ ...input, height: "auto", padding: 8, resize: "vertical" }}
                />

                {error && <div style={{ margin: "0 0 10px", fontSize: 13, color: "#c23934" }}>{error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setOpen(false)} disabled={busy} style={btnGhost}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={busy} style={btn}>
                    {busy ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </>
            )}

            {mine.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #ecebea", paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#444444", marginBottom: 6 }}>
                  My recent reports
                </div>
                {mine.slice(0, 5).map((m) => {
                  const st = STATUS_STYLE[m.status] ?? STATUS_STYLE.NEW;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 0",
                        fontSize: 12,
                        borderBottom: "1px solid #f6f6f6",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          padding: "1px 8px",
                          borderRadius: 10,
                          background: st.bg,
                          color: st.color,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {st.label}
                      </span>
                      <span
                        style={{
                          color: "#444444",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,7,7,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 440,
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
