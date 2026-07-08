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
  color: "#444444",
  marginBottom: 4,
};

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PaymentCalcInitial = {
  totalDebt?: number;
  termMonths?: number;
  firstPaymentDate?: string;
  legalPlanRequired?: boolean;
  monthlyBankFee?: number;
  citadelFee?: number;
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
  const [legalPlanRequired, setLegalPlanRequired] = useState(initial?.legalPlanRequired ?? false);
  const [monthlyBankFee, setMonthlyBankFee] = useState(initial?.monthlyBankFee ?? SF_DEFAULTS.monthlyBankFee);
  const [citadelFee, setCitadelFee] = useState(initial?.citadelFee ?? SF_DEFAULTS.citadelFee);
  const [paymentProcessor, setPaymentProcessor] = useState("SAS Processor");
  const [recordType, setRecordType] = useState<"Business Lead">("Business Lead");
  const [computed, setComputed] = useState<PaymentScheduleResult | null>(null);
  const [saving, setSaving] = useState(false);

  const live: PaymentScheduleResult = useMemo(
    () => generatePaymentSchedule({ totalDebt, termMonths, firstPaymentDate, legalPlanRequired, monthlyBankFee, citadelFee }),
    [totalDebt, termMonths, firstPaymentDate, legalPlanRequired, monthlyBankFee, citadelFee]
  );
  const result = computed ?? live;
  const t = result.totals;

  function calculate() {
    setComputed(
      generatePaymentSchedule({ totalDebt, termMonths, firstPaymentDate, legalPlanRequired, monthlyBankFee, citadelFee })
    );
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
          legalPlanRequired,
          paymentProcessor,
          setupFee: t.setupFee,
          serviceFeePerPeriod: SF_DEFAULTS.serviceFeePerPeriod,
          bankFeePerPeriod: monthlyBankFee,
          citadelFeePerPeriod: citadelFee,
          totalSettlement: t.totalSettlementAmt,
          estimatedAmount: t.newTotalDebtAmount,
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
          border: "1px solid #c9c9c9",
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
              background: "#0176d3",
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
              color: "#0176d3",
              border: "1px solid #c9c9c9",
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
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 12 }}>
          <NumField label="Total Debt" v={totalDebt} on={setTotalDebt} prefix="$" />
          <SelectField
            label="Payment Term"
            value={String(termMonths)}
            onChange={(v) => setTermMonths(Number(v))}
            options={TERM_OPTIONS.map((n) => String(n))}
          />
          <NumField label="Service Fee" v={t.weeklyServiceFee} readonly prefix="$" />
          <NumField
            label="Monthly Bank Fee"
            v={monthlyBankFee}
            on={(n) => {
              setMonthlyBankFee(n);
              setComputed(null);
            }}
            prefix="$"
          />
          <NumField label="Bank Setup Fee" v={t.bankSetupFee} readonly prefix="$" />
          <NumField
            label="Citadel Fee"
            v={citadelFee}
            on={(n) => {
              setCitadelFee(n);
              setComputed(null);
            }}
            prefix="$"
          />
          <SelectField label="Payment Frequency" value="Weekly" onChange={() => {}} options={["Weekly"]} disabled />
          <SelectField
            label="Payment Processor"
            value={paymentProcessor}
            onChange={(v) => {
              setPaymentProcessor(v);
              setComputed(null);
            }}
            options={["SAS Processor", "RAM Processor", "LAPP Processor"]}
          />
          <SelectField
            label="Legal Plan Required"
            value={legalPlanRequired ? "Yes" : "No"}
            onChange={(v) => {
              setLegalPlanRequired(v === "Yes");
              setComputed(null);
            }}
            options={["No", "Yes"]}
          />
          <NumField label="Setup Fee" v={t.setupFee} readonly prefix="$" />
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
                background: "#0176d3",
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

      {/* Schedule table — 6 columns, sortable headers, matching SF exactly */}
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "auto", maxHeight: 600 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9", position: "sticky", top: 0, zIndex: 1 }}>
              {[
                "Weekly Payment Amount",
                "Setup Fee",
                "Weekly Program Fee",
                "Weekly Service Fee",
                "Monthly Bank Fee",
                "Weekly Savings",
              ].map((h, i, arr) => (
                <th
                  key={h}
                  style={{
                    ...th,
                    borderRight: i < arr.length - 1 ? "1px solid #c9c9c9" : "none",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {h}
                    <svg width="10" height="10" viewBox="0 0 12 12" style={{ fill: "#54698d", opacity: 0.6 }}>
                      <path d="M3 4l3-3 3 3z M3 8l3 3 3-3z" />
                    </svg>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr
                key={r.index}
                style={{
                  borderBottom: "1px solid #f3f3f3",
                  background: i % 2 === 1 ? "#fcfcfc" : "#fff",
                }}
              >
                <td style={tdSep}>{fmtMoney(r.weeklyPaymentAmount)}</td>
                <td style={tdSep}>{fmtMoney(r.setupFee)}</td>
                <td style={tdSep}>{fmtMoney(r.weeklyProgramFee)}</td>
                <td style={tdSep}>{fmtMoney(r.weeklyServiceFee)}</td>
                <td style={tdSep}>{fmtMoney(r.monthlyBankFee)}</td>
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
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#747474", fontSize: 12 }}>
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
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
  whiteSpace: "nowrap",
};

const tdSep: React.CSSProperties = {
  ...td,
  borderRight: "1px solid #f3f3f3",
};
