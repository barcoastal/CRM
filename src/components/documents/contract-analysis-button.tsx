"use client";

import { useState } from "react";

/**
 * "Analyze" action per uploaded document: runs the Gemini contract analysis
 * (or opens the saved one) and shows the structured result in a modal built
 * for MCA agreements: key terms, risk flags, plain-language summary.
 */

interface Analysis {
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
  fees: string[];
  defaultClauses: string[];
  redFlags: string[];
  summary: string;
}

const money = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ContractAnalysisButton({ documentId, documentName, hasAnalysis }: { documentId: string; documentName: string; hasAnalysis: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setError(null);
    if (hasAnalysis && !analysis) {
      const res = await fetch(`/api/documents/${documentId}/analyze`);
      if (res.ok) {
        const d = (await res.json()) as { analysis: Analysis | null; analyzedAt: string | null };
        if (d.analysis) {
          setAnalysis(d.analysis);
          setAnalyzedAt(d.analyzedAt);
          return;
        }
      }
    }
    if (!analysis) void run();
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { analysis?: Analysis; analyzedAt?: string; error?: string };
      if (!res.ok || !d.analysis) {
        setError(d.error ?? "Analysis failed, please try again.");
        return;
      }
      setAnalysis(d.analysis);
      setAnalyzedAt(d.analyzedAt ?? null);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

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
    <>
      <button onClick={() => void openModal()} style={{ background: "none", border: 0, color: "#0176d3", cursor: "pointer", fontSize: 13, padding: 0 }}>
        {hasAnalysis || analysis ? "View Analysis" : "Analyze"}
      </button>

      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: "#181818", flex: 1 }}>Contract Analysis</h2>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: 0, fontSize: 18, color: "#747474", cursor: "pointer" }}>×</button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#747474" }}>
              {documentName}
              {analyzedAt ? ` · analyzed ${new Date(analyzedAt).toLocaleString("en-US")}` : ""}
            </p>

            {busy && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#747474" }}>Reading the contract with AI, this takes about 20 seconds...</div>}
            {error && <div style={{ padding: "10px 12px", background: "#fdecea", border: "1px solid #f5c2c0", borderRadius: 4, fontSize: 13, color: "#c23934", marginBottom: 10 }}>{error}</div>}

            {analysis && !busy && (
              <div style={{ fontSize: 13, color: "#181818" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {flag(analysis.hasConfessionOfJudgment, "Confession of Judgment")}
                  {flag(analysis.hasPersonalGuarantee, "Personal Guarantee")}
                  {flag(analysis.hasUccFilingClause, "UCC Filing")}
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

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => void run()} disabled={busy} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#0176d3", cursor: "pointer" }}>
                    Re-analyze
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(8,7,7,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 20, width: "100%", maxWidth: 640,
  maxHeight: "88vh", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
const sectionLbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#444444", margin: "8px 0 2px" };
const ul: React.CSSProperties = { margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.5 };
