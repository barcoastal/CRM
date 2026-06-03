"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generatePaymentSchedule,
  SF_DEFAULTS,
  type PaymentScheduleResult,
} from "@/lib/payment-schedule";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
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

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PaymentCalcInitial = {
  totalDebt?: number;
  termMonths?: number;
  firstPaymentDate?: string;
};

const TERM_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

export function PaymentCalculatorV2({
  saveEndpoint,
  initial,
}: {
  saveEndpoint: string;
  initial?: PaymentCalcInitial;
}) {
  const router = useRouter();
  const [totalDebt, setTotalDebt] = useState(initial?.totalDebt ?? 50000);
  const [termMonths, setTermMonths] = useState(initial?.termMonths ?? 6);
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    initial?.firstPaymentDate ?? new Date().toISOString().slice(0, 10)
  );
  const [recordType, setRecordType] = useState<"Business Lead">("Business Lead");
  const [computed, setComputed] = useState<PaymentScheduleResult | null>(null);
  const [saving, setSaving] = useState(false);

  const live: PaymentScheduleResult = useMemo(
    () => generatePaymentSchedule({ totalDebt, termMonths, firstPaymentDate }),
    [totalDebt, termMonths, firstPaymentDate]
  );
  const result = computed ?? live;
  const t = result.totals;

  function calculate() {
    setComputed(generatePaymentSchedule({ totalDebt, termMonths, firstPaymentDate }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalDebt,
          paymentTerm: termMonths,
          frequency: "WEEKLY",
          firstPaymentDate,
          settlementPercent: SF_DEFAULTS.settlementPercent,
          programFeePercent: SF_DEFAULTS.programFeePercent,
          retainerPercent: SF_DEFAULTS.retainerPercent,
          setupFee: SF_DEFAULTS.setupFee,
          serviceFeePerPeriod: SF_DEFAULTS.serviceFeePerPeriod,
          bankFeePerPeriod: SF_DEFAULTS.monthlyBankFee,
          citadelFeePerPeriod: 0,
          totalSettlement: t.totalSettlementAmt,
          estimatedAmount: t.totalCost,
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
      {/* Header: Calculator title + mode dropdown + Calculate + Refresh */}
      <div
        style={{
          background: "#fafaf9",
          border: "1px solid #d8dde6",
          borderRadius: 4,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginRight: 12 }}>Calculator</h3>
        <select
          value={recordType}
          onChange={(e) => setRecordType(e.target.value as "Business Lead")}
          style={{ ...inputStyle, maxWidth: 360 }}
        >
          <option value="Business Lead">Business Lead</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={calculate}
            style={{
              background: "#0070d2",
              color: "#fff",
              border: 0,
              padding: "6px 18px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Calculate
          </button>
          <button
            onClick={() => {
              setTotalDebt(0);
              setComputed(null);
            }}
            style={{
              background: "#fff",
              color: "#0070d2",
              border: "1px solid #d8dde6",
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Form fields — 7-column grid in 2 rows, matching SF */}
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <NumField label="Total Debt" v={totalDebt} on={setTotalDebt} prefix="$" />
          <SelectField
            label="Payment Term"
            value={String(termMonths)}
            onChange={(v) => setTermMonths(Number(v))}
            options={TERM_OPTIONS.map((n) => String(n))}
          />
          <NumField label="Service Fee" v={t.weeklyServiceFee} readonly prefix="$" />
          <NumField label="Monthly Bank Fee" v={t.monthlyBankFee} readonly prefix="$" />
          <NumField label="Bank Setup Fee" v={t.bankSetupFee} readonly prefix="$" />
          <SelectField label="Payment Frequency" value="Weekly" onChange={() => {}} options={["Weekly"]} disabled />
          <SelectField
            label="Setup Fee"
            value={String(t.setupFee)}
            onChange={() => {}}
            options={[String(t.setupFee)]}
            disabled
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <SelectField
            label="Settlement Percent"
            value={String(t.settlementPercent)}
            onChange={() => {}}
            options={[String(t.settlementPercent)]}
            disabled
          />
          <NumField label="Down Payment" v={0} readonly prefix="$" />
          <SelectField
            label="Program Fee Percent"
            value={String(t.programFeePercent)}
            onChange={() => {}}
            options={[String(t.programFeePercent)]}
            disabled
          />
          <SelectField
            label="Retainer Percentage"
            value={String(t.retainerPercent)}
            onChange={() => {}}
            options={[String(t.retainerPercent)]}
            disabled
          />
          <NumField label="Retainer Amount" v={t.retainerAmount} readonly prefix="$" />
          <NumField label="Total Settlement Amt" v={t.totalSettlementAmt} readonly prefix="$" />
          <NumField label="Total Program Fee" v={t.totalProgramFee} readonly prefix="$" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <NumField
            label={`Total Amount With Fees(${t.totalAmountWithFeesPercent}%)`}
            v={t.totalAmountWithFees}
            readonly
            prefix="$"
          />
          <NumField
            label={`Esitimated Amount You Save (${t.estimatedAmountYouSavePercent}%)`}
            v={t.estimatedAmountYouSave}
            readonly
            prefix="$"
          />
          <NumField label="Weekly Payments" v={t.weeklyPayments} readonly prefix="$" />
          <div>
            <label style={labelStyle}>First Payment Date</label>
            <input
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "5 / span 3", display: "flex", justifyContent: "flex-end", alignItems: "end" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: "#0070d2",
                color: "#fff",
                border: 0,
                padding: "8px 18px",
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

      {/* Schedule table — 6 columns matching SF exactly */}
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, overflow: "auto", maxHeight: 600 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6", position: "sticky", top: 0 }}>
              <th style={{ ...th, width: 50 }}>#</th>
              <th style={th}>Weekly Payment Amount</th>
              <th style={th}>Setup Fee</th>
              <th style={th}>Weekly Program Fee</th>
              <th style={th}>Weekly Service Fee</th>
              <th style={th}>Monthly Bank Fee</th>
              <th style={th}>Weekly Savings</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.index} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ ...td, color: "#706e6b" }}>{r.index}</td>
                <td style={td}>{fmtMoney(r.weeklyPaymentAmount)}</td>
                <td style={td}>{fmtMoney(r.setupFee)}</td>
                <td style={td}>{fmtMoney(r.weeklyProgramFee)}</td>
                <td style={td}>{fmtMoney(r.weeklyServiceFee)}</td>
                <td style={td}>{fmtMoney(r.monthlyBankFee)}</td>
                <td style={td}>{fmtMoney(r.weeklySavings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumField({
  label,
  v,
  on,
  prefix,
  readonly,
}: {
  label: string;
  v: number;
  on?: (n: number) => void;
  prefix?: string;
  readonly?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#706e6b", fontSize: 12 }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          step="any"
          value={readonly ? v.toFixed(2) : v}
          readOnly={readonly}
          onChange={(e) => on?.(Number(e.target.value) || 0)}
          style={{
            ...inputStyle,
            paddingLeft: prefix ? 22 : 8,
            background: readonly ? "#f3f2f2" : "#fff",
          }}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ ...inputStyle, background: disabled ? "#f3f2f2" : "#fff" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 11,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
  whiteSpace: "nowrap",
};
