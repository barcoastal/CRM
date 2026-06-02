"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Calc = {
  id?: string;
  totalDebt: number | "";
  setupFee: number | "";
  serviceFee: number | "";
  monthlyBankFee: number | "";
  settlementPercentage: number | "";
  programFeePercent: number | "";
  totalSettlement: number | "";
  programFeePeriod: number | "";
  estimatedAmount: number | "";
  retainerPercentage: number | "";
};

const empty: Calc = {
  totalDebt: "",
  setupFee: "",
  serviceFee: "",
  monthlyBankFee: "",
  settlementPercentage: "",
  programFeePercent: "",
  totalSettlement: "",
  programFeePeriod: "",
  estimatedAmount: "",
  retainerPercentage: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  color: "#080707",
  background: "#fff",
};

function num(v: number | ""): number | "" {
  return typeof v === "number" ? v : "";
}

function CalcField({
  label,
  value,
  onChange,
  derived,
  prefix,
  suffix,
}: {
  label: string;
  value: number | "";
  onChange?: (v: number | "") => void;
  derived?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f3f3f3" }}>
      <div style={{ fontSize: 11, color: "#706e6b", marginBottom: 4 }}>{label}</div>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#706e6b",
              fontSize: 13,
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          step="any"
          readOnly={derived}
          value={value}
          onChange={(e) => onChange?.(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            ...inputStyle,
            paddingLeft: prefix ? 24 : 10,
            paddingRight: suffix ? 30 : 10,
            background: derived ? "#f3f2f2" : "#fff",
            cursor: derived ? "not-allowed" : "text",
          }}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#706e6b",
              fontSize: 13,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function PaymentCalculator({
  leadId,
  initial,
}: {
  leadId: string;
  initial?: Partial<Calc>;
}) {
  const router = useRouter();
  const [c, setC] = useState<Calc>({ ...empty, ...(initial ?? {}) });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const totalSettlement = useMemo(() => {
    if (typeof c.totalDebt === "number" && typeof c.settlementPercentage === "number") {
      return Math.round(c.totalDebt * (c.settlementPercentage / 100) * 100) / 100;
    }
    return "" as number | "";
  }, [c.totalDebt, c.settlementPercentage]);

  const estimatedAmount = useMemo(() => {
    const setup = typeof c.setupFee === "number" ? c.setupFee : 0;
    const service = typeof c.serviceFee === "number" ? c.serviceFee : 0;
    const period = typeof c.programFeePeriod === "number" ? c.programFeePeriod : 0;
    const monthlyBank = typeof c.monthlyBankFee === "number" ? c.monthlyBankFee : 0;
    const settlement = typeof totalSettlement === "number" ? totalSettlement : 0;
    if (!period) return "" as number | "";
    return Math.round((setup + service + settlement + monthlyBank * period) * 100) / 100;
  }, [c.setupFee, c.serviceFee, c.programFeePeriod, c.monthlyBankFee, totalSettlement]);

  function set<K extends keyof Calc>(k: K, v: Calc[K]) {
    setC((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...c,
        totalSettlement: num(totalSettlement),
        estimatedAmount: num(estimatedAmount),
      };
      const res = await fetch(`/api/leads/${leadId}/calculator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const out = await res.json();
      setSavedAt(out.savedAt);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 32px",
        }}
      >
        <CalcField label="Total Debt" value={c.totalDebt} onChange={(v) => set("totalDebt", v)} prefix="$" />
        <CalcField label="Setup Fee" value={c.setupFee} onChange={(v) => set("setupFee", v)} prefix="$" />
        <CalcField label="Service Fee" value={c.serviceFee} onChange={(v) => set("serviceFee", v)} prefix="$" />
        <CalcField
          label="Monthly Bank Fee"
          value={c.monthlyBankFee}
          onChange={(v) => set("monthlyBankFee", v)}
          prefix="$"
        />
        <CalcField
          label="Settlement Percentage"
          value={c.settlementPercentage}
          onChange={(v) => set("settlementPercentage", v)}
          suffix="%"
        />
        <CalcField
          label="Program Fee Percent"
          value={c.programFeePercent}
          onChange={(v) => set("programFeePercent", v)}
          suffix="%"
        />
        <CalcField label="Total Settlement" value={totalSettlement} derived prefix="$" />
        <CalcField
          label="Program Fee Period (months)"
          value={c.programFeePeriod}
          onChange={(v) => set("programFeePeriod", v)}
        />
        <CalcField label="Estimated Amount" value={estimatedAmount} derived prefix="$" />
        <CalcField
          label="Retainer Percentage"
          value={c.retainerPercentage}
          onChange={(v) => set("retainerPercentage", v)}
          suffix="%"
        />
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid #ecebea",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button
          onClick={handleSave}
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
        {savedAt && (
          <span style={{ color: "#4bca81", fontSize: 12 }}>
            Saved {new Date(savedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
