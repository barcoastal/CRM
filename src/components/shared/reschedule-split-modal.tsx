"use client";

import { useMemo, useState } from "react";

/**
 * Split Retainer and Setup Fee modal — port of SF programPlans' split feature.
 *
 * The upfront retainer + setup fee (normally one draft) can be split across N
 * payments. SF: count = round((retainer + setup) / weekly draft); the total
 * (retainer + setup + bank + citadel) is spread evenly across N consecutive
 * weekly dates. Rows are editable, then Apply.
 */

export type SplitRow = { date: string; amount: number };

const WEEKDAY: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** consecutive weekly dates, snapped to the chosen weekday like the schedule. */
function splitDates(count: number, firstPaymentDate: string, weeklyPaymentDay: string): Date[] {
  const offset = WEEKDAY[weeklyPaymentDay] ?? 5;
  const out: Date[] = [];
  let d = new Date(firstPaymentDate);
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      out.push(new Date(d));
    } else {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      n.setDate(n.getDate() - n.getDay() + offset);
      out.push(n);
      d = n;
    }
  }
  return out;
}

export function RescheduleSplitModal({
  retainerAmount,
  setupFee,
  citadelFee,
  monthlyBankFee,
  bankSetupFee,
  weeklyDraft,
  firstPaymentDate,
  weeklyPaymentDay,
  onApply,
  onClose,
}: {
  retainerAmount: number;
  setupFee: number;
  citadelFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  weeklyDraft: number;
  firstPaymentDate: string;
  weeklyPaymentDay: string;
  onApply: (rows: SplitRow[]) => void;
  onClose: () => void;
}) {
  const autoRows = useMemo(() => computeAutoSplit(), [/* on mount */]);
  const [rows, setRows] = useState<SplitRow[]>(autoRows);
  const [moveDrafts, setMoveDrafts] = useState(true);

  function computeAutoSplit(): SplitRow[] {
    const count = Math.max(1, Math.round((retainerAmount + setupFee) / (weeklyDraft || 1)));
    const dates = splitDates(count, firstPaymentDate, weeklyPaymentDay);
    // bank once per distinct month (+ bank setup on first), citadel once per month
    const seenBank = new Set<string>();
    const seenCit = new Set<string>();
    let bankTotal = 0;
    let citTotal = 0;
    dates.forEach((d, i) => {
      const mk = monthKey(d);
      if (!seenBank.has(mk)) { bankTotal += monthlyBankFee; seenBank.add(mk); }
      if (i === 0) bankTotal += bankSetupFee;
      if (citadelFee > 0 && !seenCit.has(mk)) { citTotal += citadelFee; seenCit.add(mk); }
    });
    const total = retainerAmount + setupFee + bankTotal + citTotal;
    const per = r2(total / count);
    return dates.map((d, i) => ({
      date: iso(d),
      // last row absorbs the rounding remainder
      amount: i === count - 1 ? r2(total - per * (count - 1)) : per,
    }));
  }

  const citTotalDisplay = useMemo(() => {
    const seen = new Set<string>();
    let t = 0;
    for (const row of rows) {
      const mk = monthKey(new Date(row.date));
      if (citadelFee > 0 && !seen.has(mk)) { t += citadelFee; seen.add(mk); }
    }
    return t;
  }, [rows, citadelFee]);
  const bankTotalDisplay = useMemo(() => {
    const seen = new Set<string>();
    let t = 0;
    rows.forEach((row, i) => {
      const mk = monthKey(new Date(row.date));
      if (!seen.has(mk)) { t += monthlyBankFee; seen.add(mk); }
      if (i === 0) t += bankSetupFee;
    });
    return t;
  }, [rows, monthlyBankFee, bankSetupFee]);

  const totalAmount = r2(rows.reduce((s, r) => s + r.amount, 0));

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <header style={dialogHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Split Retainer and Setup Fee</h2>
          <button onClick={onClose} style={xBtn} aria-label="Close">×</button>
        </header>

        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            <RO label="Retainer Fee" value={money(retainerAmount)} />
            <RO label="Setup Fee" value={money(setupFee)} />
            <RO label="Total Citadel Fee" value={money(citTotalDisplay)} />
            <RO label="Total Bank Fee" value={money(bankTotalDisplay)} />
            <RO label="Total Amount" value={money(retainerAmount + setupFee + bankTotalDisplay + citTotalDisplay)} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button style={btnBrand} onClick={() => setRows(computeAutoSplit())}>Auto Split</button>
          </div>

          <div style={{ ...card, overflow: "auto", maxHeight: 320 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
                  <th style={th}>#</th>
                  <th style={th}>Payment Date</th>
                  <th style={th}>Amount</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))}
                        style={cellInput}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        step="any"
                        value={row.amount}
                        onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) || 0 } : r)))}
                        style={cellInput}
                      />
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        style={{ border: 0, background: "none", color: "#c23934", cursor: "pointer", fontSize: 15 }}
                        aria-label="Remove"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={moveDrafts} onChange={(e) => setMoveDrafts(e.target.checked)} />
              Move the upcoming drafts to the next viable dates
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, alignSelf: "center", color: "#706e6b" }}>
                Total: <b style={{ color: "#080707" }}>{money(totalAmount)}</b>
              </span>
              <button style={btnOutline} onClick={onClose}>Close</button>
              <button style={btnBrand} onClick={() => onApply(rows)}>Apply</button>
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

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 70, zIndex: 9999 };
const dialog: React.CSSProperties = { background: "#fff", borderRadius: 6, width: "min(720px, 94vw)", maxHeight: "84vh", overflow: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" };
const dialogHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #d8dde6" };
const xBtn: React.CSSProperties = { border: 0, background: "none", fontSize: 22, cursor: "pointer", color: "#706e6b", lineHeight: 1 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #d8dde6", borderRadius: 6 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#3e3e3c", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 10px", whiteSpace: "nowrap" };
const cellInput: React.CSSProperties = { width: "100%", height: 30, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12, background: "#fff" };
const btnBrand: React.CSSProperties = { background: "#0070d2", color: "#fff", border: 0, padding: "7px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnOutline: React.CSSProperties = { background: "#fff", color: "#0070d2", border: "1px solid #d8dde6", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
