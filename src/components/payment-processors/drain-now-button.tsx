"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Manually run the outbound processor drain (test mode = journal only). */
export function DrainNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/payment-processors/outbound", { method: "POST" });
      const j = (await res.json()) as { sas?: { batches: unknown[] }; ram?: { batches: unknown[] }; error?: string };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const n = (j.sas?.batches.length ?? 0) + (j.ram?.batches.length ?? 0);
      toast.success(n === 0 ? "Queue is empty - nothing to push" : `Processed ${n} batch${n === 1 ? "" : "es"}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Drain failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      style={{ background: "#0176d3", color: "#fff", border: "1px solid #0176d3", padding: "0 14px", height: 32, borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}
    >
      {busy ? "Running…" : "Run Sync Now"}
    </button>
  );
}
