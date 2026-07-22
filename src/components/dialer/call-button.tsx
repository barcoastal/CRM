"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  phone: string | null | undefined;
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  variant?: "primary" | "ghost" | "link";
  size?: "sm" | "md";
  label?: string;
}

/**
 * Click-to-dial button. Triggers Five9 makeCall on the agent's saved session.
 * If no Five9 session is active, the API returns a clear error toast.
 */
export function CallButton({
  phone,
  leadId,
  opportunityId: _opportunityId,
  accountId: _accountId,
  variant = "ghost",
  size = "sm",
  label = "Call",
}: Props) {
  const [busy, setBusy] = useState(false);

  async function dial() {
    if (!phone) {
      toast.error("No phone number on record");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/click-to-dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, leadId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; callId?: string };
      if (data.ok) {
        toast.success(`Calling ${phone}…`);
      } else {
        toast.error(data.error ?? "Failed to place call", { duration: 7000 });
      }
    } finally {
      setBusy(false);
    }
  }

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: size === "sm" ? "4px 10px" : "8px 16px",
    borderRadius: 4,
    fontSize: size === "sm" ? 12 : 13,
    fontWeight: 600,
    border: variant === "primary" ? 0 : "1px solid #c9c9c9",
    background: variant === "primary" ? "#0176d3" : "#fff",
    color: variant === "primary" ? "#fff" : "#0176d3",
    cursor: busy || !phone ? "not-allowed" : "pointer",
    opacity: busy || !phone ? 0.5 : 1,
  };

  if (variant === "link") {
    // SF shows the phone as a plain blue link (still click-to-dial).
    return (
      <button
        onClick={dial}
        disabled={busy || !phone}
        style={{ background: "none", border: 0, padding: 0, color: "#0176d3", fontSize: 13, cursor: busy || !phone ? "default" : "pointer", textAlign: "left" }}
        title={phone ?? "No phone"}
      >
        {label}
      </button>
    );
  }

  return (
    <button onClick={dial} disabled={busy || !phone} style={baseStyle} title={phone ?? "No phone"}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
      </svg>
      {label}
    </button>
  );
}
