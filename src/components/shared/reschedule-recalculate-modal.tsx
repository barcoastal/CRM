"use client";

import { useMemo, useState } from "react";
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";

/** Compare program lengths using the same schedule math as the saved quote. */

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
  const schedule = generateRescheduleSchedule({
    totalDebt: i.totalDebt, termMonths: term, settlementPercent: i.settlementPercent,
    programFeePercent: i.programFeePercent, retainerPercent: i.retainerPercent,
    setupFee: i.setupFee, serviceFeePerPeriod: i.serviceFee, monthlyBankFee: i.monthlyBankFee,
    bankSetupFee: i.bankSetupFee, citadelFee: i.citadelFee,
  });
  const programCost = r2(schedule.rows.reduce((sum, r) => sum + r.weeklyDraftAmount, 0));
  const weekly = schedule.totals.weeklyDraftAmount;
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
  const defaultTerms = [currentTerm - 1, currentTerm, currentTerm + 1].filter((t) => t >= 1 && t <= 30);
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
      <div style={dialog} role="dialog" aria-modal="true" aria-labelledby="recalculate-title" onClick={(e) => e.stopPropagation()}>
        <header style={dialogHeader}>
          <h2 id="recalculate-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Program Recalculate</h2>
          <button onClick={onClose} style={xBtn} aria-label="Close">×</button>
        </header>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, flexShrink: 0 }}>
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
            <div style={{ ...card, marginBottom: 16, padding: 12, flexShrink: 0 }}>
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

          <div style={{ overflow: "auto", minHeight: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Select", "Program term", "Weekly payment", "Monthly estimate", "Program cost", "Estimated savings", "Weekly savings", "Bonus"].map(h => <th key={h} style={{ textAlign: "left", padding: "12px 10px", background: "#f3f6fb", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{options.map(o => <tr key={o.term} onClick={() => setSelected(o.term)} style={{ background: selected === o.term ? "#eef6ff" : "#fff", cursor: "pointer", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 10 }}><input type="radio" name="quote-term" aria-label={`${o.term} month program`} checked={selected === o.term} onChange={() => setSelected(o.term)} /></td>
                <td style={{ padding: 10, fontWeight: 700 }}>{o.term} months</td>
                <td style={{ padding: 10 }}>{money(o.weekly)}</td>
                <td style={{ padding: 10 }}>{money(o.weekly * 52 / 12)}</td>
                <td style={{ padding: 10 }}>{money(o.programCost)}</td>
                <td style={{ padding: 10 }}>{money(o.totalSavings)}</td>
                <td style={{ padding: 10 }}>{o.weeklySaving == null ? "—" : money(o.weeklySaving)}</td>
                <td style={{ padding: 10 }}>{bonusProgramLengths.includes(o.term) ? "Eligible" : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "#667085", marginBottom: 0 }}>Compare standard program estimates here. Apply a term, then use Edit Split in the payment table to set individual amounts and dates. Save the calculation before sending a quote.</p>
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
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 9999,
};
const dialog: React.CSSProperties = {
  background: "#fff",
  borderRadius: 6,
  width: "min(1480px, 100%)",
  maxHeight: "calc(100dvh - 32px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
};
const dialogHeader: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #c9c9c9",
};
const xBtn: React.CSSProperties = { border: 0, background: "none", fontSize: 22, cursor: "pointer", color: "#747474", lineHeight: 1 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6 };


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
