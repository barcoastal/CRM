"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditorCombobox } from "@/components/debts/creditor-combobox";
import { DebtAnalysisDrawer } from "@/components/debts/debt-analysis-drawer";
import { LenderIntelCard } from "@/components/debts/lender-intel-card";
import { findLenderIntel } from "@/lib/lender-intel";
import type { ContractAnalysisData } from "@/components/documents/analysis-body";

export type OppDebtRow = {
  id: string;
  creditorName: string;
  debtType: string | null;
  paymentFrequency: string | null;
  paymentAmount: number | null;
  originalBalance: number;
  currentBalance: number;
  enrolledBalance: number;
  status: string;
  analysis?: ContractAnalysisData | null;
  analysisDocName?: string | null;
};

const TYPE_OPTIONS = [
  ["MCA", "Merchant Cash Advance"],
  ["CREDIT_LINE", "Business Credit Line"],
  ["TERM_LOAN", "Term Loan"],
  ["BUSINESS_CC", "Business Credit Card"],
  ["EQUIPMENT", "Equipment Financing"],
  ["INVOICE_FACTORING", "Invoice Factoring"],
  ["OTHER", "Other"],
];

const FREQ_OPTIONS = [
  ["DAILY", "Daily"],
  ["WEEKLY", "Weekly"],
  ["BI_WEEKLY", "Bi-Weekly"],
  ["MONTHLY", "Monthly"],
  ["LUMP_SUM", "Lump Sum"],
];

const STATUS_OPTIONS = [
  ["ENROLLED", "Enrolled"],
  ["NEGOTIATING", "Negotiating"],
  ["SETTLED", "Settled"],
  ["PAID", "Paid"],
  ["DISPUTED", "Disputed"],
  ["WRITTEN_OFF", "Written Off"],
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

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
  fontSize: 13,
};

// SF business-week conversion (mirrors LeadTriggerHandler): a Daily payment is
// weekly ×5 (5 business days), NOT annualized. e.g. $1,000/day → $5,000/week.
const PER_WEEK: Record<string, number> = {
  DAILY: 5,
  WEEKLY: 1,
  BI_WEEKLY: 0.5,
  MONTHLY: 0.25,
  LUMP_SUM: 0,
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function label(opts: string[][], v: string | null) {
  if (!v) return "";
  return opts.find(([k]) => k === v)?.[1] ?? v;
}

export function OppDebtInformation({
  opportunityId,
  items,
}: {
  opportunityId: string;
  items: OppDebtRow[];
}) {
  const router = useRouter();
  const [drawerDebt, setDrawerDebt] = useState<OppDebtRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    creditorName: "",
    debtType: "MCA",
    paymentFrequency: "DAILY",
    paymentAmount: "",
    debtAmount: "",
    status: "ENROLLED",
  });

  function resetForm() {
    setForm({
      creditorName: "",
      debtType: "MCA",
      paymentFrequency: "DAILY",
      paymentAmount: "",
      debtAmount: "",
      status: "ENROLLED",
    });
  }

  function startEdit(d: OppDebtRow) {
    setEditing(d.id);
    setAdding(false);
    setForm({
      creditorName: d.creditorName,
      debtType: d.debtType ?? "MCA",
      paymentFrequency: d.paymentFrequency ?? "DAILY",
      paymentAmount: d.paymentAmount != null ? String(d.paymentAmount) : "",
      debtAmount: String(d.originalBalance),
      status: d.status,
    });
  }

  async function save() {
    const amt = Number(form.debtAmount);
    if (!form.creditorName || !Number.isFinite(amt) || amt <= 0) return;
    setSaving(true);
    try {
      const payload = {
        creditorName: form.creditorName,
        debtType: form.debtType,
        paymentFrequency: form.paymentFrequency,
        paymentAmount: form.paymentAmount === "" ? null : Number(form.paymentAmount),
        originalBalance: amt,
        currentBalance: amt,
        enrolledBalance: amt,
        status: form.status,
      };
      const url = editing
        ? `/api/debts/${editing}`
        : `/api/opportunities/${opportunityId}/debts`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setAdding(false);
        setEditing(null);
        resetForm();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(debtId: string) {
    if (!confirm("Delete this debt?")) return;
    const res = await fetch(`/api/debts/${debtId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const totalDebt = items.reduce((s, d) => s + d.originalBalance, 0);
  const totalWeeklyPayment = items.reduce((s, d) => {
    if (d.paymentAmount == null || d.paymentAmount <= 0 || !d.paymentFrequency) return s;
    return s + d.paymentAmount * (PER_WEEK[d.paymentFrequency] ?? 1);
  }, 0);
  const showForm = adding || editing !== null;

  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 16, justifyContent: "center" }}>
        <div style={{ background: "#fafaf9", padding: "8px 16px", borderRadius: 4, border: "1px solid #c9c9c9" }}>
          <span style={{ fontSize: 13, color: "#747474", marginRight: 8 }}>Total Debt:</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(totalDebt)}</span>
        </div>
        <div style={{ background: "#fafaf9", padding: "8px 16px", borderRadius: 4, border: "1px solid #c9c9c9" }}>
          <span style={{ fontSize: 13, color: "#747474", marginRight: 8 }}>Total Weekly Payment:</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(totalWeeklyPayment)}</span>
        </div>
      </div>

      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            setAdding(true);
            setEditing(null);
            resetForm();
          }}
          style={{
            background: "#fff",
            border: "1px solid #c9c9c9",
            color: "#0176d3",
            padding: "6px 14px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Debt
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #c9c9c9" }}>
        <thead>
          <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
            <th style={th}>Creditor Name</th>
            <th style={th}>Type</th>
            <th style={th}>Debt Amount</th>
            <th style={th}>Payment</th>
            <th style={th}>Frequency</th>
            <th style={th}>Debt Status</th>
            <th style={{ ...th, width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !showForm && (
            <tr>
              <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#747474" }}>
                No debts enrolled yet. Click + Add Debt to start.
              </td>
            </tr>
          )}
          {items.map((d, i) => (
            <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={td}>
                <span style={{ color: "#747474", marginRight: 8 }}>{i + 1}</span>
                {d.creditorName}
                <RowIntel name={d.creditorName} />
                {d.analysis && (
                  <button
                    onClick={() => setDrawerDebt(d)}
                    title="View contract analysis"
                    style={{
                      marginLeft: 8,
                      background: "#eef1f8",
                      border: 0,
                      borderRadius: 10,
                      padding: "1px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#3052FF",
                      cursor: "pointer",
                    }}
                  >
                    Contract ▸
                  </button>
                )}
              </td>
              <td style={td}>{label(TYPE_OPTIONS, d.debtType)}</td>
              <td style={td}>{fmtMoney(d.originalBalance)}</td>
              <td style={td}>{d.paymentAmount != null ? fmtMoney(d.paymentAmount) : ""}</td>
              <td style={td}>{label(FREQ_OPTIONS, d.paymentFrequency)}</td>
              <td style={td}>{label(STATUS_OPTIONS, d.status)}</td>
              <td style={td}>
                <button
                  onClick={() => startEdit(d)}
                  title="Edit"
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "#0176d3", marginRight: 6 }}
                >
                  ✎
                </button>
                <button
                  onClick={() => remove(d.id)}
                  title="Delete"
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c23934" }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {showForm && (
            <tr style={{ background: "#fafaf9", borderTop: "1px solid #c9c9c9" }}>
              <td style={td}>
                <CreditorCombobox
                  value={form.creditorName}
                  onChange={(v) => setForm({ ...form, creditorName: v })}
                  placeholder="Search creditor…"
                  style={inputStyle}
                />
                <LenderIntelCard lenderName={form.creditorName} />
              </td>
              <td style={td}>
                <select value={form.debtType} onChange={(e) => setForm({ ...form, debtType: e.target.value })} style={inputStyle}>
                  {TYPE_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <input
                  type="number"
                  step="any"
                  value={form.debtAmount}
                  onChange={(e) => setForm({ ...form, debtAmount: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td style={td}>
                <input
                  type="number"
                  step="any"
                  value={form.paymentAmount}
                  onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
                  style={inputStyle}
                />
              </td>
              <td style={td}>
                <select
                  value={form.paymentFrequency}
                  onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}
                  style={inputStyle}
                >
                  {FREQ_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  {STATUS_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={save}
                    disabled={saving || !form.creditorName || !form.debtAmount}
                    style={{
                      background: "#0176d3",
                      color: "#fff",
                      border: 0,
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: saving ? "wait" : "pointer",
                    }}
                  >
                    {saving ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setEditing(null);
                      resetForm();
                    }}
                    style={{
                      background: "#fff",
                      color: "#444444",
                      border: "1px solid #c9c9c9",
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <DebtAnalysisDrawer
        open={drawerDebt != null}
        onClose={() => setDrawerDebt(null)}
        creditorName={drawerDebt?.creditorName ?? ""}
        documentName={drawerDebt?.analysisDocName ?? null}
        analysis={drawerDebt?.analysis ?? null}
      />
    </div>
  );
}

function RowIntel({ name }: { name: string }) {
  // Small inline risk marker on saved debt rows; full card shows in the form.
  const intel = findLenderIntel(name);
  if (!intel?.lienRiskLevel) return null;
  const color = intel.lienRiskLevel === 1 ? "#2e844a" : intel.lienRiskLevel === 2 ? "#8c5f10" : "#c23934";
  const parts = [
    `Risk ${intel.lienRiskLevel}`,
    intel.coj ? "COJ" : null,
    intel.tro ? "TRO" : null,
  ].filter(Boolean);
  return (
    <span
      title={intel.notes ?? undefined}
      style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color }}
    >
      {parts.join(" · ")}
    </span>
  );
}
