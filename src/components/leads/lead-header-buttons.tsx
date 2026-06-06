"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DispositionModal } from "./disposition-modal";
import { OPPORTUNITY_RECORD_TYPES } from "@/lib/record-types";
import {
  LEAD_STATUSES,
  STAGE_TO_SUB_DISPOSITIONS,
  type LeadStatusV2,
} from "@/lib/sf-canonical";

// SF Lightning header button — white pill with #d8dde6 border, blue text.
// Matches the Convert / Edit / Delete strip on the SF Lead detail page.
const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  color: "#0070d2",
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
}: {
  leadId: string;
  currentStage: LeadStatusV2;
  converted?: boolean;
}) {
  const router = useRouter();
  const [dispModal, setDispModal] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertProduct, setConvertProduct] = useState("DEBT_SETTLEMENT");
  const [submitting, setSubmitting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  async function submitConvert() {
    setSubmitting(true);
    setConvertError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityRecordType: convertProduct }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Conversion failed");
      router.push(`/accounts/${body.accountId}`);
      router.refresh();
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "Conversion failed");
      setSubmitting(false);
    }
  }

  async function deleteLead() {
    if (!confirm("Delete this lead?")) return;
    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    if (res.ok) router.push("/leads");
  }

  return (
    <>
      {!converted && (
        <button style={btn} onClick={() => setConvertOpen(true)}>
          Convert
        </button>
      )}
      <button style={btn} onClick={() => setDispModal(true)}>
        Edit
      </button>
      <button style={btn} onClick={deleteLead}>
        Delete
      </button>

      <DispositionModal
        endpoint={`/api/leads/${leadId}/disposition`}
        stages={LEAD_STATUSES}
        subDispositionsByStage={STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={dispModal}
        onClose={() => setDispModal(false)}
      />

      {convertOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !submitting && setConvertOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,7,7,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 4,
              minWidth: 480,
              maxWidth: 560,
              padding: 24,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#080707", marginBottom: 12 }}>
              Convert Lead
            </h2>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#3e3e3c",
                marginBottom: 4,
              }}
            >
              Opportunity record type
            </label>
            <select
              value={convertProduct}
              onChange={(e) => setConvertProduct(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #d8dde6",
                borderRadius: 4,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {OPPORTUNITY_RECORD_TYPES.map((rt) => (
                <option key={rt} value={rt}>{PRODUCT_LABEL[rt] ?? rt}</option>
              ))}
            </select>
            {convertError && (
              <p style={{ fontSize: 12, color: "#c23934", marginBottom: 12 }}>{convertError}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                disabled={submitting}
                onClick={() => setConvertOpen(false)}
                style={{ ...btn, color: "#080707" }}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={submitConvert}
                style={{
                  ...btn,
                  background: "#0070d2",
                  border: "1px solid #0070d2",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {submitting ? "Converting..." : "Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
