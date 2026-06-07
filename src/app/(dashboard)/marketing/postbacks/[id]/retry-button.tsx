"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RetryButton({ endpointId, logId }: { endpointId: string; logId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    const res = await fetch(`/api/marketing/postbacks/${endpointId}/retry/${logId}`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      alert("Retry failed");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={retry}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-[#3052ff] border border-[#3052ff] disabled:opacity-50"
    >
      <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} />
      Retry
    </button>
  );
}
