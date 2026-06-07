"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import { OPP_STAGES, OPP_STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";

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

export function OppHeaderButtons({
  opportunityId,
  currentStage,
  defaultEmail,
  defaultPhone,
}: {
  opportunityId: string;
  currentStage: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);

  async function updateOpp() {
    router.push(`/opportunities/${opportunityId}/edit`);
  }

  async function amendOpp() {
    const res = await fetch(`/api/opportunities/${opportunityId}/amend`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <QuickActionsRow opportunityId={opportunityId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />
      <button style={btn} onClick={() => setModal(true)}>
        Disposition
      </button>
      <button style={btn} onClick={updateOpp}>
        Update Opportunity
      </button>
      <button style={btn} onClick={amendOpp}>
        Amend Opportunity
      </button>
      <DispositionModal
        endpoint={`/api/opportunities/${opportunityId}/disposition`}
        stages={OPP_STAGES}
        subDispositionsByStage={OPP_STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={modal}
        onClose={() => setModal(false)}
      />
    </>
  );
}
