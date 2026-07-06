"use client";

import { useMemo, useState } from "react";
import {
  generateRescheduleSchedule,
  RESCHEDULE_DEFAULTS,
  type RescheduleResult,
  type RescheduleRow,
} from "@/lib/reschedule-schedule";
import { RescheduleRecalculateModal } from "./reschedule-recalculate-modal";
import { RescheduleSplitModal, type SplitRow } from "./reschedule-split-modal";

// Program lengths (months) that qualify for the "Extra Bonus" badge. Mirrors the
// SF Qualified_For_Bonus_Program_Length__c custom setting; edit as needed.
const BONUS_PROGRAM_LENGTHS = [6, 7, 8, 9, 10, 11, 12];

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
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: 16,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
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
const ro: React.CSSProperties = { ...inputStyle, background: "#f3f2f2", color: "#3e3e3c" };

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
  const [splitRows, setSplitRows] = useState<SplitRow[] | null>(null);
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

  // When a retainer/setup split is applied, replace the single setup row with the
  // split rows and re-date the program weekly draws to start after the last split.
  const displayRows: RescheduleRow[] = useMemo(() => {
    if (!splitRows || splitRows.length === 0) return result.rows;
    const splitDisplay: RescheduleRow[] = splitRows.map((s, i) => ({
      index: i + 1,
      date: new Date(s.date),
      weeklyDraftAmount: s.amount,
      programFee: 0,
      retainerFee: s.amount,
      setupFee: 0,
      bankFee: 0,
      serviceFee: 0,
      citadelFee: 0,
      escrowAmount: 0,
      runningBalance: 0,
      status: "Pending",
    }));
    const lastSplit = new Date(splitRows[splitRows.length - 1].date);
    const reDated = result.rows.slice(1).map((r, i) => {
      const d = new Date(lastSplit);
      d.setDate(d.getDate() + 7 * (i + 1));
      return { ...r, index: splitDisplay.length + i + 1, date: d };
    });
    return [...splitDisplay, ...reDated];
  }, [splitRows, result.rows]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setShowSplit(true)}
          style={{ background: "#fff", color: "#0070d2", border: "1px solid #d8dde6", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Split Retainer / Setup Fee
        </button>
        {splitRows && (
          <button
            onClick={() => setSplitRows(null)}
            style={{ background: "#fff", color: "#c23934", border: "1px solid #d8dde6", padding: "7px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Clear Split
          </button>
        )}
        <button
          onClick={() => setShowRecalc(true)}
          style={{ background: "#0070d2", color: "#fff", border: 0, padding: "7px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Recalculate
        </button>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Refresh"
          aria-label="Refresh"
          style={{ background: "#fff", color: "#0070d2", border: "1px solid #d8dde6", padding: "7px 12px", borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}
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
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
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
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 11,
                    color: "#3e3e3c",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <tr key={r.index} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                  {r.date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                </td>
                <td style={{ padding: "8px 10px" }}>{money(r.weeklyDraftAmount)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.programFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.retainerFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.setupFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.bankFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.serviceFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.citadelFee)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.escrowAmount)}</td>
                <td style={{ padding: "8px 10px" }}>{money(r.runningBalance)}</td>
                <td style={{ padding: "8px 10px", color: r.status === "Completed" ? "#2e844a" : "#706e6b" }}>
                  {r.status}
                </td>
              </tr>
            ))}
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
          retainerAmount={t.retainerAmount}
          setupFee={t.setupFee}
          citadelFee={citadelFee}
          monthlyBankFee={RESCHEDULE_DEFAULTS.monthlyBankFee}
          bankSetupFee={RESCHEDULE_DEFAULTS.bankSetupFee}
          weeklyDraft={t.weeklyDraftAmount}
          firstPaymentDate={firstPaymentDate}
          weeklyPaymentDay={weeklyPaymentDay}
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
