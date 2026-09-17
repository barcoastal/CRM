"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditorCombobox } from "@/components/debts/creditor-combobox";
import { DebtAnalysisDrawer } from "@/components/debts/debt-analysis-drawer";
import { LenderIntelCard } from "@/components/debts/lender-intel-card";
import { useLenders, matchLender } from "@/lib/use-lenders";
import type { ContractAnalysisData } from "@/components/documents/analysis-body";
import { PAYMENT_STATUSES } from "@/lib/debt-payment-status";

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
  paymentStatus?: string;
  negotiationStage?: string;
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
  ["MONTHLY", "Monthly"],
];

const STATUS_OPTIONS = PAYMENT_STATUSES.map((status) => [status, status]);

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
  readOnly = false,
  selectedDebtId,
  onSelectDebt,
}: {
  opportunityId: string;
  items: OppDebtRow[];
  readOnly?: boolean;
  selectedDebtId?: string;
  onSelectDebt?: (id: string) => void;
}) {
  const router = useRouter();
  const [drawerDebt, setDrawerDebt] = useState<OppDebtRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(selectedDebtId ?? null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inlineSaving, setInlineSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    creditorName: "",
    debtType: "MCA",
    paymentFrequency: "DAILY",
    paymentAmount: "",
    debtAmount: "",
    status: "",
  });

  function resetForm() {
    setForm({
      creditorName: "",
      debtType: "MCA",
      paymentFrequency: "DAILY",
      paymentAmount: "",
      debtAmount: "",
      status: "",
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
      status: d.paymentStatus ?? "",
    });
  }

  async function save() {
    const amt = Number(form.debtAmount);
    if (!form.creditorName || !Number.isFinite(amt) || amt <= 0 || !form.status) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        creditorName: form.creditorName,
        debtType: form.debtType,
        paymentFrequency: form.paymentFrequency,
        paymentAmount: form.paymentAmount === "" ? null : Number(form.paymentAmount),
        originalBalance: amt,
        currentBalance: amt,
        enrolledBalance: amt,
        paymentStatus: form.status,
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
      } else {
        setError("Could not save the debt. Please try again.");
      }
    } catch {
      setError("Could not save the debt. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function saveInline(debtId: string, field: "paymentFrequency" | "paymentStatus", value: string) {
    setInlineSaving(debtId);
    setError(null);
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error("Save failed");
      router.refresh();
    } catch {
      setError("Could not save the change. Please try again.");
    } finally {
      setInlineSaving(null);
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
      {error && <div role="alert" style={{ color: "#ba0517", marginBottom: 12 }}>{error}</div>}
      <div className="opp-debt-totals" style={{ display: "flex", gap: 24, marginBottom: 16, justifyContent: "center" }}>
        <div style={{ background: "#fafaf9", padding: "8px 16px", borderRadius: 4, border: "1px solid #c9c9c9" }}>
          <span style={{ fontSize: 13, color: "#747474", marginRight: 8 }}>Total Debt:</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(totalDebt)}</span>
        </div>
        <div style={{ background: "#fafaf9", padding: "8px 16px", borderRadius: 4, border: "1px solid #c9c9c9" }}>
          <span style={{ fontSize: 13, color: "#747474", marginRight: 8 }}>Total Weekly Payment:</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(totalWeeklyPayment)}</span>
        </div>
      </div>

      {!readOnly && <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
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
      </div>}

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #c9c9c9" }}>
        <thead>
          <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
            <th style={th}>Creditor Name</th>
            <th style={th}>Type</th>
            <th style={th}>Debt Amount</th>
            <th style={th}>Payment</th>
            <th style={th}>Frequency</th>
            <th style={th}>Debt Status</th>
            <th style={{ ...th, width: 100 }}>{readOnly ? "Negotiation" : ""}</th>
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
            <Fragment key={d.id}>
            <tr style={{ background: readOnly && selectedDebtId === d.id ? "#edf5fc" : undefined, borderBottom: expandedId === d.id ? "none" : "1px solid #f3f3f3" }}>
              <td style={td}>
                <button
                  onClick={() => { setExpandedId((v) => (v === d.id ? null : d.id)); onSelectDebt?.(d.id); }}
                  aria-label={expandedId === d.id ? "Collapse lender info" : "Show lender info"}
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: "#747474",
                    marginRight: 6,
                    fontSize: 11,
                    width: 16,
                  }}
                >
                  {expandedId === d.id ? "▾" : "▸"}
                </button>
                <span style={{ color: "#747474", marginRight: 8 }}>{i + 1}</span>
                {onSelectDebt ? <button type="button" onClick={() => { onSelectDebt(d.id); setExpandedId(d.id); }} style={{ background: "none", border: 0, padding: 0, color: "#0176d3", cursor: "pointer", fontWeight: 600 }}>{d.creditorName}</button> : d.creditorName}
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
              <td style={td}>
                {readOnly ? (label([...FREQ_OPTIONS, ["BI_WEEKLY", "Bi-Weekly"], ["LUMP_SUM", "Lump Sum"]], d.paymentFrequency) || "—") : <select aria-label={`Frequency for ${d.creditorName}`} value={d.paymentFrequency ?? ""} disabled={inlineSaving !== null} onChange={(e) => saveInline(d.id, "paymentFrequency", e.target.value)} style={{ ...inputStyle, minWidth: 110 }}>
                  {!FREQ_OPTIONS.some(([value]) => value === d.paymentFrequency) && <option value={d.paymentFrequency ?? ""}>{d.paymentFrequency ? label([["BI_WEEKLY", "Bi-Weekly"], ["LUMP_SUM", "Lump Sum"]], d.paymentFrequency) : "Select…"}</option>}
                  {FREQ_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>}
              </td>
              <td style={td}>
                {readOnly ? (d.paymentStatus || "Not recorded") : <select aria-label={`Debt Status for ${d.creditorName}`} value={d.paymentStatus ?? ""} disabled={inlineSaving !== null} onChange={(e) => saveInline(d.id, "paymentStatus", e.target.value)} style={{ ...inputStyle, minWidth: 110 }}>
                  {!STATUS_OPTIONS.some(([value]) => value === d.paymentStatus) && <option value={d.paymentStatus ?? ""}>{d.paymentStatus || "Select…"}</option>}
                  {STATUS_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>}
              </td>
              <td style={td}>
                {readOnly ? <><div style={{ fontSize: 11, color: "#52647a", marginBottom: 5 }}>{d.negotiationStage}</div><button type="button" onClick={() => { onSelectDebt?.(d.id); setExpandedId(d.id); }} aria-pressed={selectedDebtId === d.id} style={{ color: "#0176d3", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>{selectedDebtId === d.id ? "Selected" : "Open"}</button></> : <>
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
                </>}
              </td>
            </tr>
            {expandedId === d.id && (
              <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td colSpan={7} style={{ padding: "0 12px 12px 34px", background: "#fbfcfe" }}>
                  <ExpandedLenderInfo row={d} onOpenContract={() => setDrawerDebt(d)} />
                </td>
              </tr>
            )}
            </Fragment>
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
                  <option value="">Select…</option>
                  {form.status && !STATUS_OPTIONS.some(([value]) => value === form.status) && <option value={form.status}>{form.status}</option>}
                  {STATUS_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={save}
                    disabled={saving || !form.creditorName || !form.debtAmount || !form.status}
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
  const { lenders } = useLenders();
  const intel = matchLender(lenders, name);
  if (!intel || (!intel.lienRiskLevel && !intel.coj && !intel.tro)) return null;
  const color =
    intel.lienRiskLevel === 1 ? "#2e844a" : intel.lienRiskLevel === 2 ? "#8c5f10" : "#c23934";
  const parts = [
    intel.lienRiskLevel ? `Risk ${intel.lienRiskLevel}` : null,
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

function ExpandedLenderInfo({ row, onOpenContract }: { row: OppDebtRow; onOpenContract: () => void }) {
  const { lenders } = useLenders();
  const intel = matchLender(lenders, row.creditorName);
  return (
    <div>
      {intel ? (
        <LenderIntelCard lenderName={row.creditorName} />
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: "#747474" }}>
          No lender data on file for &quot;{row.creditorName}&quot;. Check the Lenders tab for the
          full sheet, or tell an admin to add this lender.
        </div>
      )}
      {row.analysis && (
        <button
          onClick={onOpenContract}
          style={{
            marginTop: 8,
            background: "#fff",
            border: "1px solid #3052FF",
            color: "#3052FF",
            borderRadius: 4,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          View contract analysis ▸
        </button>
      )}
    </div>
  );
}
