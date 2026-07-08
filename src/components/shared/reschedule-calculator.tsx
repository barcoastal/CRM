"use client";

import { useMemo, useState } from "react";
import {
  generateRescheduleSchedule,
  RESCHEDULE_DEFAULTS,
  type RescheduleResult,
  type RescheduleRow,
} from "@/lib/reschedule-schedule";
import { RescheduleRecalculateModal } from "./reschedule-recalculate-modal";
import { RescheduleSplitModal, computeSplit, type SplitRow, type SplitParams } from "./reschedule-split-modal";

// Program lengths (months) that qualify for the "Extra Bonus" badge. Mirrors the
// SF Qualified_For_Bonus_Program_Length__c custom setting; edit as needed.
const BONUS_PROGRAM_LENGTHS = [6, 7, 8, 9, 10, 11, 12];

type DisplayRow = RescheduleRow & { _child?: boolean };

export type RescheduleInitial = {
  totalDebt?: number;
  termMonths?: number;
  citadelFee?: number;
  firstPaymentDate?: string;
  completedDraftsCount?: number;
  completedDraftsAmount?: number;
  paymentProcessor?: string;
  noOfDebts?: number;
  currentWeeklyPayment?: number;
};

const wrap: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  padding: 16,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#444444",
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};
const ro: React.CSSProperties = { ...inputStyle, background: "#f3f2f2", color: "#444444" };

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
export function RescheduleCalculator({ initial }: { initial?: RescheduleInitial }) {
  // Debt + citadel come from the deal (read-only in the calculator, like SF).
  const totalDebt = initial?.totalDebt ?? 0;
  const [termMonths, setTermMonths] = useState(initial?.termMonths ?? 6);
  const citadelFee = initial?.citadelFee ?? RESCHEDULE_DEFAULTS.citadelFee;
  const noOfDebts = initial?.noOfDebts ?? 0;
  // Reschedule-only: number/amount of drafts already collected. Default 0 for a
  // fresh projection; not shown as an input (SF doesn't expose them here).
  const completedCount = initial?.completedDraftsCount ?? 0;
  const completedAmount = initial?.completedDraftsAmount ?? 0;
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    initial?.firstPaymentDate ?? new Date().toISOString().slice(0, 10),
  );
  const [paymentProcessor, setPaymentProcessor] = useState(initial?.paymentProcessor ?? "SAS Processor");
  const [weeklyPaymentDay, setWeeklyPaymentDay] = useState("Friday");
  const [showRecalc, setShowRecalc] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [actionMenuRow, setActionMenuRow] = useState<number | null>(null);
  const [splitRows, setSplitRows] = useState<SplitRow[] | null>(null);
  // Per-row draft actions (Add / Edit / Skip) on regular draft rows.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rowEdits, setRowEdits] = useState<Record<number, { date: string; amount: number }>>({});
  const [extraRows, setExtraRows] = useState<(DisplayRow & { _after: number })[]>([]);
  const currentWeeklyPayment = initial?.currentWeeklyPayment ?? 0;

  const [refreshKey, setRefreshKey] = useState(0);
  const result: RescheduleResult = useMemo(
    () =>
      generateRescheduleSchedule({
        totalDebt,
        termMonths,
        citadelFee,
        completedDraftsCount: completedCount,
        completedDraftsAmount: completedAmount,
        firstPaymentDate,
        weeklyPaymentDay,
      }),
    // refreshKey lets the refresh button force a recompute on demand.
    [totalDebt, termMonths, citadelFee, completedCount, completedAmount, firstPaymentDate, weeklyPaymentDay, refreshKey],
  );
  const t = result.totals;

  const TERMS = Array.from({ length: 30 }, (_, i) => i + 1);
  const PROCESSORS = ["SAS Processor", "RAM Processor", "LAPP Processor", "Reliant Processor"];
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const splitParams: SplitParams = {
    retainerAmount: t.retainerAmount,
    setupFee: t.setupFee,
    citadelFee,
    monthlyBankFee: RESCHEDULE_DEFAULTS.monthlyBankFee,
    bankSetupFee: RESCHEDULE_DEFAULTS.bankSetupFee,
    weeklyDraft: t.weeklyDraftAmount,
    firstPaymentDate,
    weeklyPaymentDay,
    legalPlanRequired: t.setupFee >= 995,
  };

  // View Split: keep the parent setup/retainer summary row, then the highlighted
  // split children (retainer = amount − setup − bank − citadel), then the program
  // draws re-dated after the last split.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const displayRows: DisplayRow[] = useMemo(() => {
    if (!splitRows || splitRows.length === 0) return result.rows;
    const total = round2(splitRows.reduce((s, r) => s + r.amount, 0));
    const bankT = round2(splitRows.reduce((s, r) => s + r.bankFee, 0));
    const citT = round2(splitRows.reduce((s, r) => s + r.citadelFee, 0));
    const parent: DisplayRow = {
      index: 1, date: new Date(splitRows[0].date), weeklyDraftAmount: total,
      programFee: 0, retainerFee: t.retainerAmount, setupFee: t.setupFee,
      bankFee: bankT, serviceFee: 0, citadelFee: citT, escrowAmount: 0,
      runningBalance: 0, status: "Pending",
    };
    let run = 0;
    const children: DisplayRow[] = splitRows.map((s, i) => {
      run = round2(run + s.amount);
      return {
        index: i + 2, date: new Date(s.date), weeklyDraftAmount: s.amount, programFee: 0,
        retainerFee: round2(s.amount - s.bankFee - s.setupFee - s.citadelFee),
        setupFee: s.setupFee, bankFee: s.bankFee, serviceFee: 0, citadelFee: s.citadelFee,
        escrowAmount: 0, runningBalance: run, status: "Pending", _child: true,
      };
    });
    const lastSplit = new Date(splitRows[splitRows.length - 1].date);
    const reDated: DisplayRow[] = result.rows.slice(1).map((r, i) => {
      const d = new Date(lastSplit);
      d.setDate(d.getDate() + 7 * (i + 1));
      return { ...r, index: 1 + children.length + i + 1, date: d };
    });
    return [parent, ...children, ...reDated];
  }, [splitRows, result.rows, t.retainerAmount, t.setupFee]);

  // Apply per-row Edit overrides and inserted (Add) rows.
  const finalRows: DisplayRow[] = useMemo(() => {
    const combined: DisplayRow[] = [];
    for (const r of displayRows) {
      combined.push(r);
      extraRows.filter((x) => x._after === r.index).forEach((x) => combined.push(x));
    }
    const rows = combined.map((r) => {
      const e = rowEdits[r.index];
      return e ? { ...r, date: new Date(e.date), weeklyDraftAmount: e.amount } : r;
    });
    // Skipping a payment DEFERS it: the program still collects the full amount,
    // so each skipped draft is re-added at the end (program extends by one week).
    const deferred = rows.filter((r) => skipped.has(r.index) && r.index !== 1);
    if (deferred.length && rows.length) {
      let d = new Date(rows[rows.length - 1].date);
      deferred.forEach((r, i) => {
        d = new Date(d);
        d.setDate(d.getDate() + 7);
        rows.push({ ...r, index: -5000 - i, date: new Date(d), status: "Pending", _child: false, runningBalance: 0 });
      });
    }
    return rows;
  }, [displayRows, rowEdits, extraRows, skipped]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        {splitRows && (
          <button
            onClick={() => setSplitRows(null)}
            style={{ background: "#fff", color: "#c23934", border: "1px solid #c9c9c9", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Clear Split
          </button>
        )}
        <button
          onClick={() => setShowRecalc(true)}
          style={{ background: "#0176d3", color: "#fff", border: 0, padding: "7px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Recalculate
        </button>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Refresh"
          aria-label="Refresh"
          style={{ background: "#fff", color: "#0176d3", border: "1px solid #c9c9c9", padding: "7px 12px", borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}
        >
          ↻
        </button>
      </div>
      <div style={{ ...wrap, marginBottom: 12 }}>
        {/* 7-column input header, 1:1 with the SF Reschedule Program panel */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
          <Field label="No of Debts Included">
            <input readOnly value={String(noOfDebts)} style={ro} />
          </Field>
          <Field label="Current Total Debt">
            <input readOnly value={money(totalDebt)} style={ro} />
          </Field>
          <Field label="Total Debt Included">
            <input readOnly value={money(totalDebt)} style={ro} />
          </Field>
          <Field label="Service Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.serviceFeePerPeriod)} style={ro} />
          </Field>
          <Field label="Payment Processor">
            <select value={paymentProcessor} onChange={(e) => setPaymentProcessor(e.target.value)} style={inputStyle}>
              {PROCESSORS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Monthly Bank Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.monthlyBankFee)} style={ro} />
          </Field>
          <Field label="Bank Setup Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.bankSetupFee)} style={ro} />
          </Field>

          <Field label="Frequency">
            <input readOnly value="Weekly" style={ro} />
          </Field>
          <Field label="Payment Term">
            <select value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} style={inputStyle}>
              {TERMS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Setup Fee">
            <input readOnly value={money(t.setupFee)} style={ro} />
          </Field>
          <Field label="Program Fee Percent">
            <input readOnly value={String(RESCHEDULE_DEFAULTS.programFeePercent)} style={ro} />
          </Field>
          <Field label="Retainer Percent">
            <input readOnly value={String(RESCHEDULE_DEFAULTS.retainerPercent)} style={ro} />
          </Field>
          <Field label="Settlement Percent">
            <input readOnly value={String(RESCHEDULE_DEFAULTS.settlementPercent)} style={ro} />
          </Field>
          <div />

          <Field label="First Payment Date">
            <input
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Weekly Payment Day">
            <select value={weeklyPaymentDay} onChange={(e) => setWeeklyPaymentDay(e.target.value)} style={inputStyle}>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Schedule */}
      <div style={{ ...wrap, overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
              {[
                "Payment Date",
                "Weekly Draft",
                "Program Fee",
                "Retainer Fee",
                "Setup Fee",
                "Bank Fee",
                "Service Fee",
                "Citadel Fee",
                "Escrow Amount",
                "Running Balance",
                "Status",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 11,
                    color: "#444444",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {finalRows.map((r) => {
              const isSkipped = skipped.has(r.index);
              const isEditing = editingRow === r.index;
              const ed = rowEdits[r.index];
              const dateVal = ed?.date ?? r.date.toISOString().slice(0, 10);
              const amtVal = ed?.amount ?? r.weeklyDraftAmount;
              return (
                <tr
                  key={r.index}
                  style={{
                    borderBottom: "1px solid #f3f3f3",
                    background: isSkipped ? "#f3f2f2" : r._child ? "#d6ecf7" : undefined,
                    opacity: isSkipped ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={dateVal}
                        onChange={(e) => setRowEdits((m) => ({ ...m, [r.index]: { date: e.target.value, amount: amtVal } }))}
                        style={{ height: 28, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12 }}
                      />
                    ) : (
                      r.date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", textDecoration: isSkipped ? "line-through" : undefined }}>
                    {isEditing ? (
                      <input
                        type="number"
                        step="any"
                        value={amtVal}
                        onChange={(e) => setRowEdits((m) => ({ ...m, [r.index]: { amount: Number(e.target.value) || 0, date: dateVal } }))}
                        style={{ width: 110, height: 28, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12 }}
                      />
                    ) : (
                      money(r.weeklyDraftAmount)
                    )}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{money(r.programFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.retainerFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.setupFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.bankFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.serviceFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.citadelFee)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.escrowAmount)}</td>
                  <td style={{ padding: "8px 10px" }}>{money(r.runningBalance)}</td>
                  <td style={{ padding: "8px 10px", color: isSkipped ? "#c23934" : r.status === "Completed" ? "#2e844a" : "#747474" }}>
                    {isSkipped ? "Skipped" : r.status}
                  </td>
                  <td style={{ padding: "8px 10px", position: "relative" }}>
                    <button
                      onClick={() => setActionMenuRow((cur) => (cur === r.index ? null : r.index))}
                      aria-label="Row actions"
                      style={{ border: "1px solid #c9c9c9", background: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                    >
                      ▾
                    </button>
                    {actionMenuRow === r.index && (
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "100%",
                          zIndex: 20,
                          background: "#fff",
                          border: "1px solid #c9c9c9",
                          borderRadius: 4,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          minWidth: 120,
                        }}
                      >
                        {r.index === 1 ? (
                          <>
                            <button onClick={() => { setActionMenuRow(null); setShowSplit(true); }} style={menuItem}>Edit Split</button>
                            <button onClick={() => { setActionMenuRow(null); setSplitRows(computeSplit(splitParams)); }} style={menuItem}>View Split</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setActionMenuRow(null);
                                setExtraRows((xs) => [
                                  ...xs,
                                  { ...r, index: -(xs.length + 1), _after: r.index, _child: false, status: "Pending", runningBalance: 0 },
                                ]);
                              }}
                              style={menuItem}
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setActionMenuRow(null); setEditingRow((cur) => (cur === r.index ? null : r.index)); }}
                              style={menuItem}
                            >
                              {isEditing ? "Done" : "Edit"}
                            </button>
                            <button
                              onClick={() => {
                                setActionMenuRow(null);
                                setSkipped((s) => {
                                  const n = new Set(s);
                                  if (n.has(r.index)) n.delete(r.index);
                                  else n.add(r.index);
                                  return n;
                                });
                              }}
                              style={menuItem}
                            >
                              {isSkipped ? "Unskip" : "Skip"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

      {showRecalc && (
        <RescheduleRecalculateModal
          currentTerm={termMonths}
          inputs={{
            totalDebt,
            settlementPercent: RESCHEDULE_DEFAULTS.settlementPercent,
            programFeePercent: RESCHEDULE_DEFAULTS.programFeePercent,
            retainerPercent: RESCHEDULE_DEFAULTS.retainerPercent,
            setupFee: RESCHEDULE_DEFAULTS.setupFee,
            serviceFee: RESCHEDULE_DEFAULTS.serviceFeePerPeriod,
            monthlyBankFee: RESCHEDULE_DEFAULTS.monthlyBankFee,
            bankSetupFee: RESCHEDULE_DEFAULTS.bankSetupFee,
            citadelFee,
            currentWeeklyPayment,
          }}
          bonusProgramLengths={BONUS_PROGRAM_LENGTHS}
          onApply={(t) => {
            setTermMonths(t);
            setShowRecalc(false);
          }}
          onClose={() => setShowRecalc(false)}
        />
      )}

      {showSplit && (
        <RescheduleSplitModal
          params={splitParams}
          existingRows={splitRows}
          onApply={(rows) => {
            setSplitRows(rows);
            setShowSplit(false);
          }}
          onClose={() => setShowSplit(false)}
        />
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: 0,
  background: "none",
  padding: "8px 12px",
  fontSize: 13,
  color: "#181818",
  cursor: "pointer",
};
