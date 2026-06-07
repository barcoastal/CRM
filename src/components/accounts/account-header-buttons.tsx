"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import { ACCOUNT_STAGES, ACCOUNT_STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dddbda",
  color: "#0070d2",
  padding: "0 12px",
  height: 32,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const chevronBtn: React.CSSProperties = {
  ...btn,
  padding: "0 8px",
  width: 32,
  justifyContent: "center",
};

export function AccountHeaderButtons({
  accountId,
  currentStage,
  defaultEmail,
  defaultPhone,
}: {
  accountId: string;
  currentStage: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
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
      <QuickActionsRow accountId={accountId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />
      <button style={btn} onClick={() => setModal(true)}>Disposition</button>
      <button style={btn} onClick={() => router.push(`/accounts/${accountId}/edit`)}>Edit</button>
      <button style={btn} onClick={sync} disabled={syncing}>
        {syncing ? "Syncing" : "Sync to Payment Processor"}
      </button>
      <button style={chevronBtn} aria-label="More" title="More">
        <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "#0070d2" }}>
          <path d="M0 2l5 6 5-6z" />
        </svg>
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
