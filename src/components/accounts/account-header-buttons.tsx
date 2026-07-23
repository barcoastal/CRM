"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import { ACCOUNT_STAGES, ACCOUNT_STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";
import { RecordEditModal, type EditField } from "@/components/slds/record-edit-modal";

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "0 12px",
  height: 32,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const groupBtn: React.CSSProperties = {
  ...btn,
  border: 0,
  borderRadius: 0,
};

export function AccountHeaderButtons({
  accountId,
  accountName,
  currentStage,
  defaultEmail,
  defaultPhone,
  editFields = [],
}: {
  accountId: string;
  accountName?: string;
  currentStage: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  editFields?: EditField[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync-processor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; mode?: string; processor?: string; steps?: Array<{ step: string; status: string }>; error?: string };
      if (res.ok && j.ok) {
        const summary = (j.steps ?? []).map((s) => `${s.step}: ${s.status}`).join(" · ");
        toast.success(j.mode === "test" ? `TEST MODE - payloads journaled (${j.processor}). ${summary}` : `Enrolled with ${j.processor}. ${summary}`, { duration: 8000 });
        router.refresh();
      } else {
        toast.error(j.error ?? "Enrollment failed", { duration: 8000 });
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <QuickActionsRow accountId={accountId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />
      {/* SF renders the record actions as ONE joined button group. */}
      <div style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <button style={groupBtn} onClick={() => setModal(true)}>Disposition</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => (editFields.length > 0 ? setEditOpen(true) : router.push(`/accounts/${accountId}/edit`))}>Edit</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={sync} disabled={syncing}>
          {syncing ? "Syncing" : "Sync to Payment Processor"}
        </button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9", padding: "0 10px" }} aria-label="More" title="More">
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "#0176d3" }}>
            <path d="M0 2l5 6 5-6z" />
          </svg>
        </button>
      </div>
      <RecordEditModal
        recordTitle={accountName ?? "Account"}
        endpointBase={`/api/accounts/${accountId}/field`}
        fields={editFields}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
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
