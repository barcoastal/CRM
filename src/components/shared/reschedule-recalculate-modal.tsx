"use client";

import { useMemo, useState } from "react";

/**
 * Program Recalculate modal — port of SF's `programPlanModal` LWC.
 *
 * Shows the client program options across payment terms (default: term−1, term,
 * term+1) as cards, each with the weekly payment, new program cost, total
 * estimated savings, and estimated weekly saving. A "Compare With Other Program"
 * toggle lets you add more terms. Terms in `bonusProgramLengths` show the
 * "Qualified for Extra Bonus" badge. Picking a card + Apply sets the term.
 *
 * Formulas are 1:1 with programPlanModal.js:
 *   programCost = settlement + programFee + setup + retainer + bank×term
 *               + service×(term×4−1) + bankSetup + citadel×term
 *   weekly      = (programCost − retainer − setup) / (term×4−1)
 *   totalSaving = totalDebt − programCost
 *   weeklySaving= currentWeeklyPayment − weekly
 */

export type RecalcInputs = {
  totalDebt: number;
  settlementPercent: number;
  programFeePercent: number;
  retainerPercent: number;
  setupFee: number;
  serviceFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  citadelFee: number;
  currentWeeklyPayment: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function computeOption(term: number, i: RecalcInputs) {
  const settlement = i.totalDebt * (i.settlementPercent / 100);
  const programFee = i.totalDebt * (i.programFeePercent / 100);
  const retainer = i.totalDebt * (i.retainerPercent / 100);
  const N = term * 4 - 1;
  const programCost = r2(
    settlement +
      programFee +
      i.setupFee +
      retainer +
      i.monthlyBankFee * term +
      i.serviceFee * N +
      i.bankSetupFee +
      i.citadelFee * term,
  );
  const weekly = r2((programCost - retainer - i.setupFee) / N);
  const totalSavings = r2(i.totalDebt - programCost);
  const weeklySaving = i.currentWeeklyPayment > 0 ? r2(i.currentWeeklyPayment - weekly) : null;
  return { term, weekly, programCost, totalSavings, weeklySaving };
}

const ALL_TERMS = Array.from({ length: 30 }, (_, i) => i + 1);

export function RescheduleRecalculateModal({
  currentTerm,
  inputs,
  bonusProgramLengths,
  onApply,
  onClose,
}: {
  currentTerm: number;
  inputs: RecalcInputs;
  bonusProgramLengths: number[];
  onApply: (term: number) => void;
  onClose: () => void;
}) {
  const defaultTerms = [currentTerm - 1, currentTerm, currentTerm + 1].filter((t) => t >= 1);
  const [terms, setTerms] = useState<number[]>(defaultTerms);
  const [selected, setSelected] = useState<number>(currentTerm);
  const [showCompare, setShowCompare] = useState(false);

  const options = useMemo(
    () => [...terms].sort((a, b) => a - b).map((t) => computeOption(t, inputs)),
    [terms, inputs],
  );

  function toggleTerm(t: number) {
    setTerms((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <header style={dialogHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Program Recalculate</h2>
          <button onClick={onClose} style={xBtn} aria-label="Close">×</button>
        </header>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button style={btnOutline} onClick={() => setShowCompare((s) => !s)}>
              Compare With Other Program
            </button>
            <button
              style={btnBrand}
              onClick={() => onApply(selected)}
            >
              Apply
            </button>
          </div>

          {showCompare && (
            <div style={{ ...card, marginBottom: 16, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add program lengths to compare</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_TERMS.map((t) => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={terms.includes(t)} onChange={() => toggleTerm(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {options.map((o) => {
              const isSel = o.term === selected;
              const qualifies = bonusProgramLengths.includes(o.term);
              return (
                <div
                  key={o.term}
                  onClick={() => setSelected(o.term)}
                  style={{
                    ...card,
                    minWidth: 230,
                    flexShrink: 0,
                    cursor: "pointer",
                    border: isSel ? "2px solid #1a96ff" : "1px solid #c9c9c9",
                    position: "relative",
                  }}
                >
                  {isSel && <div style={checkMark}>✓</div>}
                  <div style={{ padding: 14 }}>
                    {qualifies && <div style={bonusBadge}>✓ Qualified for Extra Bonus</div>}
                    <div style={{ fontSize: 24, fontWeight: 700, color: o.weekly < 0 ? "#c23934" : "#181818" }}>
                      {money(o.weekly)}
                    </div>
                    <div style={{ fontSize: 12, color: "#747474", marginBottom: 10 }}>Weekly Payment</div>
                    <div style={cardLine}>
                      <span>New Estimated Program Cost:</span>
                      <b>{money(o.programCost)}</b>
                    </div>
                    <div style={cardLine}>
                      <span>Total Estimated Savings:</span>
                      <b>{money(o.totalSavings)}</b>
                    </div>
                    <div style={cardLine}>
                      <span>Estimated Weekly Saving:</span>
                      <b>{o.weeklySaving != null ? money(o.weeklySaving) : "-"}</b>
                    </div>
                    <div style={{ marginTop: 10, color: "#1a96ff", fontWeight: 600, fontSize: 13 }}>
                      {o.term} Month Program
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: 80,
  zIndex: 9999,
};
const dialog: React.CSSProperties = {
  background: "#fff",
  borderRadius: 6,
  width: "min(880px, 94vw)",
  maxHeight: "80vh",
  overflow: "auto",
  boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
};
const dialogHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #c9c9c9",
};
const xBtn: React.CSSProperties = { border: 0, background: "none", fontSize: 22, cursor: "pointer", color: "#747474", lineHeight: 1 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6 };
const cardLine: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#444444", padding: "2px 0" };
const bonusBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#2e844a",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 12,
  padding: "3px 10px",
  marginBottom: 8,
};
const checkMark: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  width: 0,
  height: 0,
  borderTop: "28px solid #1a96ff",
  borderLeft: "28px solid transparent",
};
const btnBrand: React.CSSProperties = {
  background: "#0176d3",
  color: "#fff",
  border: 0,
  padding: "7px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  background: "#fff",
  color: "#0176d3",
  border: "1px solid #c9c9c9",
  padding: "7px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
