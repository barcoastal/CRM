"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SendButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!confirm("Send this SMS campaign now? This texts every recipient in the audience.")) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/email-center/sms-campaigns/${id}`, { method: "POST" });
      if (res.ok) router.refresh();
      else setErr((await res.json().catch(() => ({}))).error ?? "Send failed.");
    } finally { setBusy(false); }
  }

  if (disabled) return <span style={{ color: "#1a9e4b", fontWeight: 700, fontSize: 14 }}>Sent</span>;
  return (
    <div>
      <button onClick={send} disabled={busy} style={{ background: "#3052ff", color: "#fff", border: 0, borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Sending..." : "Send now"}
      </button>
      {err && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
