"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generatePaymentSchedule,
  type Frequency,
  type PaymentScheduleResult,
} from "@/lib/payment-schedule";

const FREQS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 30,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
};

const required = <span style={{ color: "#c23934", marginRight: 2 }}>*</span>;

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PaymentCalcInitial = {
  totalDebt?: number;
  settlementPercent?: number;
  programFeePercent?: number;
  retainerPercent?: number;
  setupFee?: number;
  serviceFeePerPeriod?: number;
  bankFeePerPeriod?: number;
  citadelFeePerPeriod?: number;
  paymentTerm?: number;
  frequency?: Frequency;
  firstPaymentDate?: string;
};

export function PaymentCalculatorV2({
  saveEndpoint,
  initial,
}: {
  saveEndpoint: string;
  initial?: PaymentCalcInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    totalDebt: initial?.totalDebt ?? 44000,
    settlementPercent: initial?.settlementPercent ?? 40,
    programFeePercent: initial?.programFeePercent ?? 25,
    retainerPercent: initial?.retainerPercent ?? 30,
    setupFee: initial?.setupFee ?? 4000,
    serviceFeePerPeriod: initial?.serviceFeePerPeriod ?? 9.95,
    bankFeePerPeriod: initial?.bankFeePerPeriod ?? 9.95,
    citadelFeePerPeriod: initial?.citadelFeePerPeriod ?? 0,
    paymentTerm: initial?.paymentTerm ?? 50,
    frequency: (initial?.frequency ?? "WEEKLY") as Frequency,
    firstPaymentDate: initial?.firstPaymentDate ?? new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const schedule: PaymentScheduleResult = useMemo(
    () => generatePaymentSchedule({ ...form }),
    [form]
  );

  function setN<K extends keyof typeof form>(k: K, v: number) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          totalSettlement: schedule.totals.totalSettlement,
          estimatedAmount: schedule.totals.totalProgramCost,
        }),
      });
      if (res.ok) {
        toast.success("Calculator saved");
        router.refresh();
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Inputs */}
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <Field label="No of Debts Included" hint="(read-only)" value={1} readonly />
          <NumField label="Current Total Debt" required v={form.totalDebt} on={(v) => setN("totalDebt", v)} prefix="$" />
          <NumField label="Total Debt Included" v={form.totalDebt} readonly prefix="$" />
          <NumField label="Service Fee" required v={form.serviceFeePerPeriod} on={(v) => setN("serviceFeePerPeriod", v)} prefix="$" />
          <Field label="Payment Processor" value="Reliant" readonly />
          <NumField label="Monthly Bank Fee" required v={form.bankFeePerPeriod} on={(v) => setN("bankFeePerPeriod", v)} prefix="$" />
          <NumField label="Bank Setup Fee" v={form.setupFee} on={(v) => setN("setupFee", v)} prefix="$" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>{required}Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
              style={inputStyle}
            >
              {FREQS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <NumField label="Payment Term" required v={form.paymentTerm} on={(v) => setN("paymentTerm", v)} integer />
          <NumField label="Setup Fee" v={form.setupFee} on={(v) => setN("setupFee", v)} prefix="$" />
          <NumField label="Program Fee Percent" required v={form.programFeePercent} on={(v) => setN("programFeePercent", v)} suffix="%" />
          <NumField label="Retainer Percent" required v={form.retainerPercent} on={(v) => setN("retainerPercent", v)} suffix="%" />
          <NumField label="Settlement Percent" required v={form.settlementPercent} on={(v) => setN("settlementPercent", v)} suffix="%" />
          <NumField label="Citadel Fee" v={form.citadelFeePerPeriod} on={(v) => setN("citadelFeePerPeriod", v)} prefix="$" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 5fr", gap: 12, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>{required}First Payment Date</label>
            <input
              type="date"
              value={form.firstPaymentDate}
              onChange={(e) => setForm({ ...form, firstPaymentDate: e.target.value })}
              style={inputStyle}
            />
          </div>
          <Field label="Weekly Payment Day" value={new Date(form.firstPaymentDate).toLocaleDateString("en-US", { weekday: "long" })} readonly />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: "#0070d2",
                color: "#fff",
                border: 0,
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save Calculator Details"}
            </button>
          </div>
        </div>
      </div>

      {/* Schedule + totals */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, overflow: "auto", maxHeight: 520 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6", position: "sticky", top: 0 }}>
                <th style={th}>Payment Date</th>
                <th style={th}>Weekly Draft</th>
                <th style={th}>Program Fee</th>
                <th style={th}>Retained Fee</th>
                <th style={th}>Setup Fee</th>
                <th style={th}>Bank Fee</th>
                <th style={th}>Service Fee</th>
                <th style={th}>Citadel Fee</th>
                <th style={th}>Escrow Amount</th>
                <th style={th}>Running Balance</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.index} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={td}>{r.date.toLocaleDateString()}</td>
                  <td style={td}>{fmtMoney(r.weeklyDraftAmount)}</td>
                  <td style={td}>{fmtMoney(r.programFee)}</td>
                  <td style={td}>{fmtMoney(r.retainedFee)}</td>
                  <td style={td}>{fmtMoney(r.setupFee)}</td>
                  <td style={td}>{fmtMoney(r.bankFee)}</td>
                  <td style={td}>{fmtMoney(r.serviceFee)}</td>
                  <td style={td}>{fmtMoney(r.citadelFee)}</td>
                  <td style={td}>{fmtMoney(r.escrowAmount)}</td>
                  <td style={td}>{fmtMoney(r.runningBalance)}</td>
                  <td style={td}>
                    <span
                      style={{
                        background: r.status === "Completed" ? "#ddf5d6" : "#ecebea",
                        color: r.status === "Completed" ? "#0b683b" : "#3e3e3c",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#fafaf9", borderTop: "1px solid #d8dde6", fontWeight: 700 }}>
                <td style={td}>Total</td>
                <td style={td}>{fmtMoney(schedule.totals.totalProgramCost)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalProgramFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalRetainedFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalSetupFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalBankFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalServiceFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalCitadelFee)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalEscrowAmount)}</td>
                <td style={td}>{fmtMoney(schedule.totals.totalEscrowAmount)}</td>
                <td style={td} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right summary */}
        <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 12, height: "fit-content" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Total Payments Summary</h3>
          <SummaryRow label="Program Length" value={`${schedule.totals.programLength} periods`} />
          <SummaryRow label="Total Retainer Payment Cost" value={fmtMoney(schedule.totals.totalRetainerPaymentCost)} />
          <SummaryRow label="Total Retained Fee" value={fmtMoney(schedule.totals.totalRetainedFee)} />
          <SummaryRow label="Total Program Cost" value={fmtMoney(schedule.totals.totalProgramCost)} highlight />
          <SummaryRow label="Total Program Fee" value={fmtMoney(schedule.totals.totalProgramFee)} />
          <SummaryRow label="Total Setup Fee" value={fmtMoney(schedule.totals.totalSetupFee)} />
          <SummaryRow label="Total Bank Fee" value={fmtMoney(schedule.totals.totalBankFee)} />
          <SummaryRow label="Total Service Fee" value={fmtMoney(schedule.totals.totalServiceFee)} />
          <SummaryRow label="Total Citadel Fee" value={fmtMoney(schedule.totals.totalCitadelFee)} />
          <SummaryRow label="Total Processor Fee" value={fmtMoney(schedule.totals.totalProcessorFee)} />
          <SummaryRow label="Total Escrow Amount" value={fmtMoney(schedule.totals.totalEscrowAmount)} highlight />
          <SummaryRow label="Estimated Amount You Save" value={fmtMoney(schedule.totals.estimatedAmountYouSave)} positive />
          <SummaryRow label="Total Weekly Payment" value={fmtMoney(schedule.totals.totalWeeklyPayment)} />
          <SummaryRow label="Total Weekly Saving" value={fmtMoney(schedule.totals.totalWeeklySaving)} positive />
        </article>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        borderBottom: "1px solid #f3f3f3",
        fontSize: 11,
      }}
    >
      <span style={{ color: "#706e6b" }}>{label}</span>
      <span
        style={{
          fontWeight: highlight ? 700 : 600,
          color: positive ? "#04844b" : "#080707",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, value, readonly, hint }: { label: string; value: string | number; readonly?: boolean; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}{hint && <span style={{ color: "#706e6b", marginLeft: 4 }}>{hint}</span>}</label>
      <input value={value as string} readOnly={readonly} style={{ ...inputStyle, background: readonly ? "#f3f2f2" : "#fff" }} />
    </div>
  );
}

function NumField({
  label,
  required,
  v,
  on,
  prefix,
  suffix,
  readonly,
  integer,
}: {
  label: string;
  required?: boolean;
  v: number;
  on?: (n: number) => void;
  prefix?: string;
  suffix?: string;
  readonly?: boolean;
  integer?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{required && <span style={{ color: "#c23934", marginRight: 2 }}>*</span>}{label}</label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#706e6b", fontSize: 12 }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={integer ? 1 : "any"}
          value={v}
          readOnly={readonly}
          onChange={(e) => on?.(Number(e.target.value) || 0)}
          style={{
            ...inputStyle,
            paddingLeft: prefix ? 22 : 8,
            paddingRight: suffix ? 22 : 8,
            background: readonly ? "#f3f2f2" : "#fff",
          }}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#706e6b", fontSize: 12 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 700,
  fontSize: 10,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "8px 10px",
  color: "#080707",
  fontSize: 12,
  whiteSpace: "nowrap",
};
