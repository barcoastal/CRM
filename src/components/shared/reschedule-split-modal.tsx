"use client";

import { useMemo, useState } from "react";

/**
 * Split Retainer and Setup Fee — port of SF programPlans' split feature.
 *
 * The upfront retainer + setup fee can be split across N payments.
 * SF: count = round((retainer + setup) / weekly draft). Each row carries a bank
 * fee (monthly bank once per new month + bank-setup on the first row) and a
 * citadel fee (once per new month, skipping the first month). The total
 * (retainer + setup + bank + citadel) is spread evenly across the N dates.
 */

export type SplitRow = { date: string; amount: number; bankFee: number; citadelFee: number; setupFee: number };

export type SplitParams = {
  retainerAmount: number;
  setupFee: number;
  citadelFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  weeklyDraft: number;
  firstPaymentDate: string;
  weeklyPaymentDay: string;
  /** $995 legal plan puts setup on row 0; else on row 1 (SF calculateSetupFee). */
  legalPlanRequired?: boolean;
};

const WEEKDAY: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function splitDates(count: number, firstPaymentDate: string, weeklyPaymentDay: string): Date[] {
  const offset = WEEKDAY[weeklyPaymentDay] ?? 5;
  const out: Date[] = [];
  let d = new Date(firstPaymentDate);
  for (let i = 0; i < count; i++) {
    if (i === 0) out.push(new Date(d));
    else {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      n.setDate(n.getDate() - n.getDay() + offset);
      out.push(n);
      d = n;
    }
  }
  return out;
}

/** Auto Split: the exact SF row set (count, per-row fees, even payment amount). */
export function computeSplit(p: SplitParams): SplitRow[] {
  const count = Math.max(1, Math.round((p.retainerAmount + p.setupFee) / (p.weeklyDraft || 1)));
  const dates = splitDates(count, p.firstPaymentDate, p.weeklyPaymentDay);
  const seenBank = new Set<string>();
  const seenCit = new Set<string>();
  if (dates.length) seenCit.add(monthKey(dates[0])); // citadel skips the first month
  const fees = dates.map((d, i) => {
    const mk = monthKey(d);
    let bankFee = 0;
    if (!seenBank.has(mk)) { bankFee += p.monthlyBankFee; seenBank.add(mk); }
    if (i === 0) bankFee += p.bankSetupFee;
    let citadelFee = 0;
    if (p.citadelFee > 0 && !seenCit.has(mk)) { citadelFee = p.citadelFee; seenCit.add(mk); }
    return { date: iso(d), bankFee, citadelFee };
  });
  const bankTotal = fees.reduce((s, f) => s + f.bankFee, 0);
  const citTotal = fees.reduce((s, f) => s + f.citadelFee, 0);
  const total = p.retainerAmount + p.setupFee + bankTotal + citTotal;
  const per = r2(total / count);
  // SF calculateSetupFee: setup fee lands on row 0 (legal plan) or row 1 (else).
  const setupIdx = p.legalPlanRequired ? 0 : Math.min(1, count - 1);
  return fees.map((f, i) => ({
    ...f,
    setupFee: i === setupIdx ? p.setupFee : 0,
    amount: i === count - 1 ? r2(total - per * (count - 1)) : per,
  }));
}

export function RescheduleSplitModal({
  params,
  existingRows,
  readOnly = false,
  onApply,
  onClose,
}: {
  params: SplitParams;
  existingRows?: SplitRow[] | null;
  readOnly?: boolean;
  onApply: (rows: SplitRow[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SplitRow[]>(
    existingRows && existingRows.length ? existingRows : computeSplit(params),
  );
  const [moveDrafts, setMoveDrafts] = useState(true);

  const bankTotal = useMemo(() => r2(rows.reduce((s, r) => s + r.bankFee, 0)), [rows]);
  const citTotal = useMemo(() => r2(rows.reduce((s, r) => s + r.citadelFee, 0)), [rows]);
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
            <RO label="Total Citaldel Fee" value={String(citTotal)} />
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
                <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
                  {!readOnly && <th style={th}>Actions</th>}
                  <th style={th}>Payment Date</th>
                  <th style={th}>Bank Fee</th>
                  <th style={th}>Citadel Fee</th>
                  <th style={th}>Payment Amount</th>
                  <th style={th}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
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
                            style={circBtn("#1589ee")}
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
                          step="any"
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

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            {readOnly ? <span /> : (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={moveDrafts} onChange={(e) => setMoveDrafts(e.target.checked)} />
                Move the upcoming drafts to the next viable dates
              </label>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnOutline} onClick={onClose}>Close</button>
              {!readOnly && <button style={btnBrand} onClick={() => onApply(rows)}>Apply</button>}
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
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#3e3e3c", marginBottom: 4 }}>{label}</label>
      <input readOnly value={value} style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#f3f2f2" }} />
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, zIndex: 9999 };
const dialog: React.CSSProperties = { background: "#fff", borderRadius: 6, width: "min(760px, 95vw)", maxHeight: "86vh", overflow: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" };
const dialogHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #d8dde6" };
const xBtn: React.CSSProperties = { border: 0, background: "none", fontSize: 22, cursor: "pointer", color: "#706e6b", lineHeight: 1 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #d8dde6", borderRadius: 6 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#3e3e3c", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 10px", whiteSpace: "nowrap" };
const cellInput: React.CSSProperties = { width: "100%", height: 30, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12, background: "#fff" };
const circBtn = (bg: string): React.CSSProperties => ({ width: 24, height: 24, borderRadius: "50%", border: 0, background: bg, color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" });
const btnBrand: React.CSSProperties = { background: "#0070d2", color: "#fff", border: 0, padding: "7px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnOutline: React.CSSProperties = { background: "#fff", color: "#0070d2", border: "1px solid #d8dde6", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
