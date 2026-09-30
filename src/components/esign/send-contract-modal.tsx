"use client";

/**
 * Send-from-Opportunity modal. Pairs with /api/esign/envelopes/send.
 *
 * Lifecycle:
 *  - on `open`, fetch active templates once
 *  - user picks template -> documentName is auto-filled if blank
 *  - submit calls POST /api/esign/envelopes/send, then shows the signing URL
 *    so the rep can copy it or jump to it
 *
 * Intentionally NOT wired through the existing /api/envelopes/* single-blob
 * flow. The two flows coexist: template-driven send (this modal) and
 * upload-a-PDF blob (the older NewEnvelopeModal).
 */
import type { Agreement } from "@/lib/creditor-agreements";

export interface SendContractModalProps {
  opportunityId: string;
  defaultSigner?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  /** Agreement recommended by the creditors on the file (VLP -> Victory, else Citadel). */
  recommendedAgreement?: Agreement | null;
  open: boolean;
  onClose: () => void;
}

export function SendContractModal({
  opportunityId,
  defaultSigner,
  open,
  onClose,
}: SendContractModalProps) {
  if (!open) return null;
  const query = new URLSearchParams({
    opportunityId,
    name: defaultSigner?.name ?? "",
    email: defaultSigner?.email ?? "",
  });
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0006",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          maxWidth: 520,
        }}
      >
        <h2>Prepare and send contract</h2>
        <p>
          Review the client details, choose documents and recipients, then place
          signing fields before sending.
        </p>
        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <button onClick={onClose}>Cancel</button>
          <a href={`/envelopes/new?${query}`}>Review contract details →</a>
        </div>
      </div>
    </div>
  );
}
