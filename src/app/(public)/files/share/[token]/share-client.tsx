"use client";

import { useState } from "react";

export function SharePageClient({
  token,
  passwordProtected,
  filename,
}: {
  token: string;
  passwordProtected: boolean;
  filename: string;
}) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/files/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {passwordProtected && (
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444444", marginBottom: 4 }}>
            Password
          </span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to access"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13 }}
            onKeyDown={(e) => e.key === "Enter" && download()}
          />
        </label>
      )}
      {err && (
        <p style={{ color: "#c23934", fontSize: 12, marginTop: 0, marginBottom: 12 }}>{err}</p>
      )}
      <button
        onClick={download}
        disabled={busy || (passwordProtected && !password)}
        style={{
          width: "100%",
          background: "#3052ff",
          color: "#fff",
          border: 0,
          padding: "10px 14px",
          borderRadius: 4,
          cursor: busy ? "wait" : "pointer",
          fontSize: 14,
          fontWeight: 600,
          opacity: busy || (passwordProtected && !password) ? 0.7 : 1,
        }}
      >
        {busy ? "Downloading..." : "Download"}
      </button>
    </div>
  );
}
