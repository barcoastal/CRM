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
import { GetQuoteModal } from "@/components/opportunities/get-quote-modal";

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "0 12px",
  height: 32,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
};

const groupBtn: React.CSSProperties = {
  ...{
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "0 12px",
  height: 32,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
},
  border: 0,
  borderRadius: 0,
};

const menuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
  background: "transparent", border: 0, cursor: "pointer", fontSize: 13, color: "#181818",
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
  const [moreMenu, setMoreMenu] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [packetModal, setPacketModal] = useState(false);
  const [quoteModal, setQuoteModal] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  async function sendBookingLink() {
    setBookingBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/book-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) alert(`Booking link emailed to ${d.sentTo}. The client can now pick a time.`);
      else alert(`${d.error ?? "Could not send booking link."}${d.url ? `\n\nLink: ${d.url}` : ""}`);
    } finally { setBookingBusy(false); }
  }

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
      <button
        onClick={() => setQuoteModal(true)}
        style={{
          background: "#0b5cab",
          border: "1px solid #0b5cab",
          color: "#fff",
          padding: "0 14px",
          height: 32,
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Get Quote
      </button>
      <button
        onClick={() => void sendBookingLink()}
        disabled={bookingBusy}
        style={{ background: "#fff", border: "1px solid #0b5cab", color: "#0b5cab", padding: "0 14px", height: 32, borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: bookingBusy ? 0.6 : 1 }}
      >
        {bookingBusy ? "Sending..." : "Book Call"}
      </button>
      {/* SF opp header shows exactly: Disposition | Update Opportunity |
          Amend Opportunity, plus a chevron menu holding our extra actions. */}
      <div style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "visible", position: "relative" }}>
        <button style={groupBtn} onClick={() => setModal(true)}>Disposition</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => void updateOpp()}>Update Opportunity</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => void amendOpp()}>Amend Opportunity</button>
        <button
          style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9", padding: "0 10px" }}
          aria-label="More actions"
          onClick={() => setMoreMenu((v) => !v)}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "#0176d3" }}>
            <path d="M0 2l5 6 5-6z" />
          </svg>
        </button>
        {moreMenu && (
          <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 30, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", minWidth: 190, marginTop: 2 }}>
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); setContractModal(true); }}>Send Contract</button>
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); setPacketModal(true); }}>Send Packet</button>
            <div style={{ padding: "6px 12px", borderTop: "1px solid #ecebea" }}>
              <CategoryPicker opportunityId={opportunityId} value={initialCategory} size="sm" />
            </div>
            <div style={{ padding: "6px 12px" }}><SubmitForApprovalButton entityType="Opportunity" entityId={opportunityId} /></div>
          </div>
        )}
      </div>
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
      <GetQuoteModal
        opportunityId={opportunityId}
        open={quoteModal}
        onClose={() => setQuoteModal(false)}
      />
    </>
  );
}
