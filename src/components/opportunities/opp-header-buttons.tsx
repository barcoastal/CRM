"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import { SendContractModal } from "@/components/esign/send-contract-modal";
import { SendPacketModal } from "@/components/contracts/send-packet-modal";
import { OPP_STAGES, OPP_STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";
import { CategoryPicker } from "@/components/forecasting/category-picker";
import {
  defaultCategoryForStage,
  isForecastCategory,
  type ForecastCategory,
} from "@/lib/forecasting/categories";
import { SubmitButton as SubmitForApprovalButton } from "@/components/approvals/submit-button";

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
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: "#0176d3",
  color: "#fff",
  borderColor: "#0176d3",
};

export function OppHeaderButtons({
  opportunityId,
  currentStage,
  defaultEmail,
  defaultPhone,
  defaultSignerName,
  forecastCategory,
  recommendedAgreement,
}: {
  opportunityId: string;
  currentStage: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  defaultSignerName?: string | null;
  forecastCategory?: string | null;
  recommendedAgreement?: "Victory" | "Citadel" | null;
}) {
  const initialCategory: ForecastCategory =
    forecastCategory && isForecastCategory(forecastCategory)
      ? (forecastCategory as ForecastCategory)
      : defaultCategoryForStage(currentStage);
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [packetModal, setPacketModal] = useState(false);

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
      <CategoryPicker opportunityId={opportunityId} value={initialCategory} size="sm" />
      <SubmitForApprovalButton entityType="Opportunity" entityId={opportunityId} />
      <button style={{ ...primaryBtn, background: "#2e844a", borderColor: "#2e844a" }} onClick={() => setPacketModal(true)}>
        Send Packet
      </button>
      <button style={primaryBtn} onClick={() => setContractModal(true)}>
        Send Contract
      </button>
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
      <SendContractModal
        opportunityId={opportunityId}
        defaultSigner={{ name: defaultSignerName ?? null, email: defaultEmail ?? null, phone: defaultPhone ?? null }}
        recommendedAgreement={recommendedAgreement}
        open={contractModal}
        onClose={() => setContractModal(false)}
      />
      <SendPacketModal
        opportunityId={opportunityId}
        defaultSigner={{ name: defaultSignerName ?? null, email: defaultEmail ?? null }}
        open={packetModal}
        onClose={() => setPacketModal(false)}
      />
    </>
  );
}
