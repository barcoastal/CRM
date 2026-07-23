"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DispositionModal } from "./disposition-modal";
import { ConvertLeadModal } from "./convert-lead-modal";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import {
  LEAD_STATUSES,
  STAGE_TO_SUB_DISPOSITIONS,
  type LeadStatusV2,
} from "@/lib/sf-canonical";

// SF Lightning header button — white pill with #c9c9c9 border, blue text.
// Matches the Convert / Edit / Delete strip on the SF Lead detail page.
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
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
};

const PRODUCT_LABEL: Record<string, string> = {
  DEBT_SETTLEMENT: "Debt Settlement",
  BUYOUT: "Buyout",
  RESTRUCTURE: "Restructure",
  LIMITED_ASSET_PROTECTION: "Limited Asset Protection",
};

export function LeadHeaderButtons({
  leadId,
  currentStage,
  converted,
  defaultEmail,
  defaultPhone,
  businessName,
  contactName,
}: {
  leadId: string;
  currentStage: LeadStatusV2;
  converted?: boolean;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  businessName?: string;
  contactName?: string;
}) {
  const router = useRouter();
  const [dispModal, setDispModal] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const splitName = (n: string | undefined): [string, string] => {
    const parts = (n ?? "").trim().split(/\s+/);
    if (parts.length === 0) return ["", ""];
    if (parts.length === 1) return [parts[0], ""];
    return [parts[0], parts.slice(1).join(" ")];
  };
  const [firstSeed, lastSeed] = splitName(contactName);

  async function addToDnc() {
    if (!confirm("Add this lead's phone number(s) to the Do Not Call list?")) return;
    const res = await fetch(`/api/leads/${leadId}/dnc`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to add to DNC. Please try again.");
    }
  }

  return (
    <>
      {/* SF Lightning Lead header action strip: three primary buttons then a
          caret (▼) dropdown for the overflow Quick Actions. Verified against
          the SF screenshot Bar shared 2026-06-07. */}
      {!converted && (
        <button style={btn} onClick={() => setConvertOpen(true)}>
          Convert
        </button>
      )}
      <button style={btn} onClick={() => setDispModal(true)}>
        Disposition
      </button>
      <button style={btn} onClick={addToDnc}>
        Add Numbers To DNC
      </button>
      <QuickActionsRow leadId={leadId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />

      <DispositionModal
        endpoint={`/api/leads/${leadId}/disposition`}
        stages={LEAD_STATUSES}
        subDispositionsByStage={STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={dispModal}
        onClose={() => setDispModal(false)}
      />

      <ConvertLeadModal
        leadId={leadId}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        initialAccountName={businessName ?? contactName ?? ""}
        initialContactFirstName={firstSeed}
        initialContactLastName={lastSeed}
        initialOpportunityName={businessName ? `${businessName}-` : ""}
      />
    </>
  );
}
