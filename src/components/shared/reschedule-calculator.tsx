"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateRescheduleSchedule,
  RESCHEDULE_DEFAULTS,
  type RescheduleResult,
} from "@/lib/reschedule-schedule";

export type RescheduleInitial = {
  totalDebt?: number;
  termMonths?: number;
  citadelFee?: number;
  firstPaymentDate?: string;
  completedDraftsCount?: number;
  completedDraftsAmount?: number;
  paymentProcessor?: string;
  noOfDebts?: number;
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
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <input readOnly value={value} style={ro} />
    </Field>
  );
}

/** Format a digits/decimal string with thousands separators, preserving a
 * trailing "." or partial decimals so the user can keep typing. */
function formatLive(raw: string): string {
  if (raw === "") return "";
  const dot = raw.indexOf(".");
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const intFmt = intPart === "" ? "" : Number(intPart).toLocaleString("en-US");
  if (dot === -1) return intFmt;
  const decPart = raw.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${intFmt}.${decPart}`;
}

/** Money text input that shows thousands separators as you type. */
function MoneyInput({
  value,
  onChange,
  style,
}: {
  value: number;
  onChange: (n: number) => void;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(value ? value.toLocaleString("en-US") : "");
  const lastNum = useRef(value);

  // Resync when the value changes from outside (e.g. initial / reset), but not
  // while the user is mid-edit (when our own onChange already matches).
  useEffect(() => {
    if (value !== lastNum.current) {
      lastNum.current = value;
      setText(value ? value.toLocaleString("en-US") : "");
    }
  }, [value]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const num = raw === "" ? 0 : Number(raw) || 0;
    lastNum.current = num;
    onChange(num);
    setText(formatLive(raw));
  }

  return <input inputMode="decimal" value={text} onChange={handle} style={style} />;
}

export function RescheduleCalculator({ initial }: { initial?: RescheduleInitial }) {
  const [totalDebt, setTotalDebt] = useState(initial?.totalDebt ?? 0);
  const [termMonths, setTermMonths] = useState(initial?.termMonths ?? 6);
  const [citadelFee, setCitadelFee] = useState(initial?.citadelFee ?? RESCHEDULE_DEFAULTS.citadelFee);
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

  const result: RescheduleResult = useMemo(
    () =>
      generateRescheduleSchedule({
        totalDebt,
        termMonths,
        citadelFee,
        completedDraftsCount: completedCount,
        completedDraftsAmount: completedAmount,
        firstPaymentDate,
      }),
    [totalDebt, termMonths, citadelFee, completedCount, completedAmount, firstPaymentDate],
  );
  const t = result.totals;

  const TERMS = Array.from({ length: 30 }, (_, i) => i + 1);
  const PROCESSORS = ["SAS Processor", "RAM Processor", "LAPP Processor", "Reliant Processor"];
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  return (
    <div>
      <div style={{ ...wrap, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          <Field label="Total Debt">
            <MoneyInput value={totalDebt} onChange={setTotalDebt} style={inputStyle} />
          </Field>
          <Field label="No of Debts Included">
            <input readOnly value={String(noOfDebts)} style={ro} />
          </Field>
          <Field label="Current Total Debt">
            <input readOnly value={money(totalDebt)} style={ro} />
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
          <Field label="Service Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.serviceFeePerPeriod)} style={ro} />
          </Field>
          <Field label="Monthly Bank Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.monthlyBankFee)} style={ro} />
          </Field>
          <Field label="Bank Setup Fee">
            <input readOnly value={money(RESCHEDULE_DEFAULTS.bankSetupFee)} style={ro} />
          </Field>
          <Field label="Citadel Fee (per month)">
            <MoneyInput value={citadelFee} onChange={setCitadelFee} style={inputStyle} />
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
          <Field label="Payment Processor">
            <select value={paymentProcessor} onChange={(e) => setPaymentProcessor(e.target.value)} style={inputStyle}>
              {PROCESSORS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <ReadField label="Retainer Amount" value={money(t.retainerAmount)} />
          <ReadField label="Total Settlement Amt" value={money(t.settlementAmount)} />
          <ReadField label="Total Program Fee" value={money(t.programFeeAmount)} />
          <ReadField label="Estimated Program Cost" value={money(t.estimatedProgramCost)} />
          <ReadField label="Estimated Savings" value={money(t.estimatedSavings)} />
          <ReadField label="Weekly Draft Amount" value={money(t.weeklyDraftAmount)} />
          <ReadField label="No. of Payments" value={String(t.noOfPayments)} />
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
            {result.rows.map((r) => (
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
    </div>
  );
}
