"use client";

import { useEffect, useState } from "react";
import { AnalysisBody, type ContractAnalysisData } from "@/components/documents/analysis-body";

/**
 * Slide-out panel (from the right) showing the contract analysis attached to
 * a debt row. Bar explicitly wanted a slide, not a popup window.
 */
export function DebtAnalysisDrawer({
  open,
  onClose,
  creditorName,
  documentName,
  analysis,
}: {
  open: boolean;
  onClose: () => void;
  creditorName: string;
  documentName: string | null;
  analysis: ContractAnalysisData | null;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      // next frame so the transform transition runs
      const t = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(t);
    }
    setShown(false);
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(8,7,7,0.25)", zIndex: 900 }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(520px, 92vw)",
          background: "#fff",
          zIndex: 901,
          boxShadow: "-4px 0 16px rgba(0,0,0,0.2)",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform .22s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
        aria-label={`Contract analysis for ${creditorName}`}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: "1px solid #ecebea",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#181818" }}>
              Contract Analysis - {creditorName}
            </h2>
            {documentName && (
              <div style={{ fontSize: 12, color: "#747474", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {documentName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: 0, fontSize: 20, color: "#747474", cursor: "pointer" }}
          >
            ×
          </button>
        </header>
        <div style={{ padding: 18, overflowY: "auto" }}>
          {analysis ? (
            <AnalysisBody analysis={analysis} />
          ) : (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#747474" }}>
              No analysis attached to this debt yet. Analyze the contract on the Documents tab.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
