"use client";

import { findLenderIntel } from "@/lib/lender-intel";
import { isVictoryCreditor } from "@/lib/creditor-agreements";

/**
 * Intel card shown beside the creditor picker (and inside the contract
 * drawer) the moment the chosen lender matches Bar's lender sheet.
 */
export function LenderIntelCard({ lenderName }: { lenderName: string | null | undefined }) {
  const intel = findLenderIntel(lenderName);
  if (!intel) return null;
  const legal =
    isVictoryCreditor(intel.name) || isVictoryCreditor(lenderName ?? "") ? "Victory" : "Citadel";

  const risk = intel.lienRiskLevel;
  const riskStyle =
    risk === 1
      ? { label: "Risk 1 - works with us", bg: "#eaf5ec", color: "#2e844a" }
      : risk === 2
      ? { label: "Risk 2 - medium", bg: "#fdf3e2", color: "#8c5f10" }
      : risk === 3
      ? { label: "Risk 3 - aggressive", bg: "#fdecea", color: "#c23934" }
      : null;

  const chip = (label: string) => (
    <span
      key={label}
      style={{
        padding: "1px 10px",
        borderRadius: 10,
        background: "#fdecea",
        color: "#c23934",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      ⚠ {label}
    </span>
  );

  return (
    <div
      style={{
        marginTop: 8,
        border: "1px solid #e4e8f5",
        borderLeft: "3px solid #3052FF",
        borderRadius: 4,
        padding: "10px 12px",
        background: "#fbfcfe",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: "#181818", fontSize: 13 }}>{intel.name}</span>
        {intel.aka && <span style={{ color: "#747474" }}>aka {intel.aka}</span>}
        {riskStyle && (
          <span
            style={{
              padding: "1px 10px",
              borderRadius: 10,
              background: riskStyle.bg,
              color: riskStyle.color,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {riskStyle.label}
          </span>
        )}
        {intel.coj && chip("COJ")}
        {intel.tro && chip("TRO")}
        {intel.plaidFinicity && (
          <span style={{ padding: "1px 10px", borderRadius: 10, background: "#eef1f8", color: "#3052FF", fontSize: 11, fontWeight: 700 }}>
            Plaid/Finicity
          </span>
        )}
        <span
          style={{
            padding: "1px 10px",
            borderRadius: 10,
            background: legal === "Victory" ? "#eaf5ec" : "#eef1f8",
            color: legal === "Victory" ? "#2e844a" : "#3052FF",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Legal: {legal}
        </span>
        {intel.venue && <span style={{ color: "#444444" }}>Sues in: {intel.venue}</span>}
      </div>
      {intel.notes && <div style={{ color: "#181818", lineHeight: 1.5 }}>{intel.notes}</div>}
    </div>
  );
}
