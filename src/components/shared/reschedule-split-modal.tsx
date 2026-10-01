"use client";

import { useState } from "react";

import { computeSplit, allocateSplitSetup, validateSplit, updateSplitFees, type SplitRow, type SplitParams } from "@/lib/payments/retainer-split";
export { computeSplit, type SplitRow, type SplitParams } from "@/lib/payments/retainer-split";
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RescheduleSplitModal({
  params,
  existingRows,
  readOnly = false,
  initialMoveDrafts = true,
  onApply,
  onClose,
}: {
  params: SplitParams;
  existingRows?: SplitRow[] | null;
  readOnly?: boolean;
  initialMoveDrafts?: boolean;
  onApply: (rows: SplitRow[], moveDrafts: boolean) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SplitRow[]>(
    existingRows && existingRows.length ? existingRows : computeSplit(params),
  );
  const [moveDrafts, setMoveDrafts] = useState(initialMoveDrafts);
  const appliedRows = readOnly ? rows : allocateSplitSetup(updateSplitFees(rows, params), params.setupFee, params.legalPlanRequired ? 0 : Math.min(1, rows.length - 1));
  const validationError = validateSplit(appliedRows, params.retainerAmount, params.setupFee);

  const bankTotal = r2(appliedRows.reduce((s, r) => s + r.bankFee, 0));
  const citTotal = r2(appliedRows.reduce((s, r) => s + r.citadelFee, 0));
  const totalAmount = r2(rows.reduce((s, r) => s + r.amount, 0));
  let running = 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <header style={dialogHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {readOnly ? "View Split" : "Split Retainer and Setup Fee"}
          </h2>
          <button onClick={onClose} style={xBtn} aria-label="Close">×</button>
        </header>

        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            <RO label="Retainer Fee" value={String(params.retainerAmount)} />
            <RO label="Setup Fee" value={String(params.setupFee)} />
            <RO label="Total Citadel Fee" value={String(citTotal)} />
            <RO label="Total Bank Fee" value={String(bankTotal)} />
            <RO label="Total Amount" value={String(totalAmount)} />
          </div>

          {!readOnly && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button style={btnBrand} onClick={() => setRows(computeSplit(params))}>Auto Split</button>
            </div>
          )}

          <div style={{ ...card, overflow: "auto", maxHeight: 340 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
                  {!readOnly && <th style={th}>Actions</th>}
                  <th style={th}>Payment Date</th>
                  <th style={th}>Bank Fee</th>
                  <th style={th}>Citadel Fee</th>
                  <th style={th}>Payment Amount</th>
                  <th style={th}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {appliedRows.map((row, i) => {
                  running = r2(running + row.amount);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      {!readOnly && (
                        <td style={{ ...td, display: "flex", gap: 6 }}>
                          <button
                            onClick={() => setRows((rs) => [
                              ...rs.slice(0, i + 1),
                              { date: row.date, amount: 0, bankFee: 0, citadelFee: 0, setupFee: 0 },
                              ...rs.slice(i + 1),
                            ])}
                            style={circBtn("#0176d3")}
                            aria-label="Add row"
                          >
                            +
                          </button>
                          <button
                            onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                            style={circBtn("#ea6b66")}
                            aria-label="Remove row"
                          >
                            🗑
                          </button>
                        </td>
                      )}
                      <td style={td}>
                        <input
                          type="date"
                          value={row.date}
                          readOnly={readOnly}
                          onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))}
                          style={{ ...cellInput, background: readOnly ? "#f3f2f2" : "#fff" }}
                        />
                      </td>
                      <td style={td}>{money(row.bankFee)}</td>
                      <td style={td}>{money(row.citadelFee)}</td>
                      <td style={td}>
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          readOnly={readOnly}
                          onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) || 0 } : r)))}
                          style={{ ...cellInput, background: readOnly ? "#f3f2f2" : "#fff", width: 120 }}
                        />
                      </td>
                      <td style={td}>{money(running)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!readOnly && <p style={{ fontSize: 12, color: "#667085" }}>Applying a new split replaces any individual draft edits in this calculation.</p>}
          {!readOnly && validationError && <p role="alert" style={{ color: "#c23934", fontSize: 12 }}>{validationError}</p>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            {readOnly ? <span /> : (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={moveDrafts} onChange={(e) => setMoveDrafts(e.target.checked)} />
                Move the upcoming drafts to the next viable dates
              </label>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnOutline} onClick={onClose}>Close</button>
              {!readOnly && <button style={btnBrand} disabled={Boolean(validationError)} onClick={() => onApply(appliedRows, moveDrafts)}>Apply</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RO({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444444", marginBottom: 4 }}>{label}</label>
      <input readOnly value={value} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#f3f2f2" }} />
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 9999 };
const dialog: React.CSSProperties = { background: "#fff", borderRadius: 6, width: "min(760px, 95vw)", maxHeight: "86vh", overflow: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" };
const dialogHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #c9c9c9" };
const xBtn: React.CSSProperties = { border: 0, background: "none", fontSize: 22, cursor: "pointer", color: "#747474", lineHeight: 1 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#444444", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 10px", whiteSpace: "nowrap" };
const cellInput: React.CSSProperties = { width: "100%", height: 30, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12, background: "#fff" };
const circBtn = (bg: string): React.CSSProperties => ({ width: 24, height: 24, borderRadius: "50%", border: 0, background: bg, color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" });
const btnBrand: React.CSSProperties = { background: "#0176d3", color: "#fff", border: 0, padding: "7px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnOutline: React.CSSProperties = { background: "#fff", color: "#0176d3", border: "1px solid #c9c9c9", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
