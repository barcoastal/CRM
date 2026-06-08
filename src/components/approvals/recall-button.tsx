"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecallButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    if (!window.confirm("Recall this approval request? It will return to you for edits.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/requests/${requestId}/recall`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(data.error ?? "Recall failed");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#9d1414] bg-[#fde2e2] disabled:opacity-60"
    >
      {busy ? "Recalling..." : "Recall"}
    </button>
  );
}
