"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

export function ShareLinkModal({ documentId, open, onClose }: Props) {
  const router = useRouter();
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/files/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          password: password || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setCreated({ token: json.token });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shareUrl = created
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/files/share/${created.token}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 4,
          width: "min(520px, 100%)",
          margin: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #c9c9c9", display: "flex", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#181818", flex: 1, margin: 0 }}>
            Create share link
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: 0, fontSize: 20, cursor: "pointer", color: "#747474" }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {!created ? (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444444", marginBottom: 4 }}>
                  Expires at (optional)
                </span>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444444", marginBottom: 4 }}>
                  Password (optional, min 4 chars)
                </span>
                <input
                  type="text"
                  placeholder="Leave blank for public link"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13 }}
                />
              </label>
              {err && <p style={{ color: "#c23934", fontSize: 12, margin: "8px 0" }}>{err}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  onClick={onClose}
                  style={{ background: "#fff", border: "1px solid #c9c9c9", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={create}
                  disabled={busy}
                  style={{ background: "#3052ff", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 4, cursor: busy ? "wait" : "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  {busy ? "Creating..." : "Create link"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#444444", marginTop: 0 }}>Share link created. Copy the URL below.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={shareUrl ?? ""}
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => shareUrl && navigator.clipboard.writeText(shareUrl)}
                  style={{ background: "#3052ff", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  Copy
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  onClick={onClose}
                  style={{ background: "#fff", border: "1px solid #c9c9c9", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
