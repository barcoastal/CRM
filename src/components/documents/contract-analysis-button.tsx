"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnalysisBody } from "./analysis-body";

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
  hasTroClause: boolean;
  fees: string[];
  defaultClauses: string[];
  redFlags: string[];
  summary: string;
}

export function ContractAnalysisButton({ documentId, documentName, hasAnalysis }: { documentId: string; documentName: string; hasAnalysis: boolean }) {
  const router = useRouter();
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
      const d = (await res.json().catch(() => ({}))) as {
        analysis?: Analysis;
        analyzedAt?: string;
        error?: string;
        debtCreated?: { creditorName: string; amount: number } | null;
      };
      if (!res.ok || !d.analysis) {
        setError(d.error ?? "Analysis failed, please try again.");
        return;
      }
      setAnalysis(d.analysis);
      setAnalyzedAt(d.analyzedAt ?? null);
      if (d.debtCreated) {
        toast.success(
          `Debt added: ${d.debtCreated.creditorName} - $${d.debtCreated.amount.toLocaleString()}`,
        );
        router.refresh();
      }
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

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
              <>
                <AnalysisBody analysis={analysis} />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => void run()} disabled={busy} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#0176d3", cursor: "pointer" }}>
                    Re-analyze
                  </button>
                </div>
              </>
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
  maxHeight: "88vh", overflowY: "auto", overflowX: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
