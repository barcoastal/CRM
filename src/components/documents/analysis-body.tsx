"use client";

/**
 * Shared renderer for a saved contract analysis: risk badges, key terms,
 * summary, red flags, fees, default triggers. Used by the Documents-tab
 * modal and the Debt Information slide-out drawer.
 */

export interface ContractAnalysisData {
  docType: string;
  funderName: string | null;
  merchantName: string | null;
  agreementDate: string | null;
  fundingAmount: number | null;
  paybackAmount: number | null;
  factorRate: number | null;
  paymentAmount: number | null;
  paymentFrequency: string | null;
  estimatedTermDays: number | null;
  hasConfessionOfJudgment: boolean;
  hasPersonalGuarantee: boolean;
  hasUccFilingClause: boolean;
  hasTroClause?: boolean;
  fees: string[];
  defaultClauses: string[];
  redFlags: string[];
  summary: string;
}

const money = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function AnalysisBody({ analysis }: { analysis: ContractAnalysisData }) {
  const flag = (on: boolean, label: string) => (
    <span
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        background: on ? "#fdecea" : "#eaf5ec",
        color: on ? "#c23934" : "#2e844a",
      }}
    >
      {on ? "⚠" : "✓"} {label}
    </span>
  );

  return (
    <div style={{ fontSize: 13, color: "#181818" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {flag(analysis.hasConfessionOfJudgment, "Confession of Judgment")}
        {flag(analysis.hasPersonalGuarantee, "Personal Guarantee")}
        {flag(analysis.hasUccFilingClause, "UCC Filing")}
        {flag(!!analysis.hasTroClause, "TRO / Injunction")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", marginBottom: 14 }}>
        {([
          ["Document type", analysis.docType],
          ["Agreement date", analysis.agreementDate ?? "-"],
          ["Funder", analysis.funderName ?? "-"],
          ["Merchant", analysis.merchantName ?? "-"],
          ["Amount funded", money(analysis.fundingAmount)],
          ["Total payback", money(analysis.paybackAmount)],
          ["Factor rate", analysis.factorRate != null ? analysis.factorRate.toFixed(2) : "-"],
          ["Payment", `${money(analysis.paymentAmount)}${analysis.paymentFrequency ? ` ${analysis.paymentFrequency}` : ""}`],
          ["Estimated term", analysis.estimatedTermDays != null ? `${analysis.estimatedTermDays} days` : "-"],
        ] as Array<[string, string]>).map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid #f3f3f3", padding: "3px 0" }}>
            <span style={{ color: "#444444", fontSize: 12, fontWeight: 600 }}>{l}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#f2f4f9", borderRadius: 6, padding: "10px 14px", marginBottom: 12, lineHeight: 1.55 }}>
        {analysis.summary}
      </div>

      {analysis.redFlags.length > 0 && (
        <>
          <div style={sectionLbl}>Red flags</div>
          <ul style={ul}>{analysis.redFlags.map((f, i) => <li key={i} style={{ color: "#c23934" }}>{f}</li>)}</ul>
        </>
      )}
      {analysis.fees.length > 0 && (
        <>
          <div style={sectionLbl}>Fees</div>
          <ul style={ul}>{analysis.fees.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      )}
      {analysis.defaultClauses.length > 0 && (
        <>
          <div style={sectionLbl}>Default triggers</div>
          <ul style={ul}>{analysis.defaultClauses.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      )}
    </div>
  );
}

const sectionLbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#444444", margin: "8px 0 2px" };
const ul: React.CSSProperties = { margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.5 };
