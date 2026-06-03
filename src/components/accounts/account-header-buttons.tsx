"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { ACCOUNT_STAGES, ACCOUNT_STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  color: "#0070d2",
  padding: "4px 12px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function AccountHeaderButtons({
  accountId,
  currentStage,
}: {
  accountId: string;
  currentStage: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync-processor`, { method: "POST" });
      if (res.ok) {
        toast.success("Synced to payment processor");
        router.refresh();
      } else {
        toast.error("Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <button style={btn} onClick={() => setModal(true)}>Disposition</button>
      <button style={btn} onClick={() => router.push(`/accounts/${accountId}/edit`)}>Edit</button>
      <button style={btn} onClick={sync} disabled={syncing}>
        {syncing ? "Syncing…" : "Sync to Payment Processor"}
      </button>
      <DispositionModal
        endpoint={`/api/accounts/${accountId}/disposition`}
        stages={ACCOUNT_STAGES}
        subDispositionsByStage={ACCOUNT_STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={modal}
        onClose={() => setModal(false)}
      />
    </>
  );
}
