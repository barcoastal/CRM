"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type LeadDebtRow = {
  id: string;
  type: string;
  creditorName: string | null;
  amount: number;
  frequency: string;
  paymentAmount: number | null;
  status: string;
  notes: string | null;
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
  ["ACTIVE", "Active"],
  ["DEFAULTED", "Defaulted"],
  ["SETTLED", "Settled"],
  ["PAID_OFF", "Paid Off"],
  ["DISPUTED", "Disputed"],
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
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
  fontSize: 13,
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function label(opts: string[][], v: string) {
  return opts.find(([k]) => k === v)?.[1] ?? v;
}

export function DebtInformation({
  leadId,
  items,
}: {
  leadId: string;
  items: LeadDebtRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "MCA",
    creditorName: "",
    amount: "",
    frequency: "DAILY",
    paymentAmount: "",
    status: "ACTIVE",
    notes: "",
  });

  function resetForm() {
    setForm({
      type: "MCA",
      creditorName: "",
      amount: "",
      frequency: "DAILY",
      paymentAmount: "",
      status: "ACTIVE",
      notes: "",
    });
  }

  function startEdit(d: LeadDebtRow) {
    setEditing(d.id);
    setAdding(false);
    setForm({
      type: d.type,
      creditorName: d.creditorName ?? "",
      amount: String(d.amount),
      frequency: d.frequency,
      paymentAmount: d.paymentAmount != null ? String(d.paymentAmount) : "",
      status: d.status,
      notes: d.notes ?? "",
    });
  }

  async function save() {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt < 0) return;
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        creditorName: form.creditorName || null,
        amount: amt,
        frequency: form.frequency,
        paymentAmount: form.paymentAmount === "" ? null : Number(form.paymentAmount),
        status: form.status,
        notes: form.notes || null,
      };
      const url = editing
        ? `/api/leads/${leadId}/debts/${editing}`
        : `/api/leads/${leadId}/debts`;
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
    if (!confirm("Delete this debt entry?")) return;
    const res = await fetch(`/api/leads/${leadId}/debts/${debtId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const total = items.reduce((sum, d) => sum + d.amount, 0);
  const totalWeekly = items.reduce((sum, d) => sum + (d.paymentAmount ?? 0), 0);
  const showForm = adding || editing !== null;

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#706e6b" }}>Total Debt</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#131b2e" }}>{fmtMoney(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#706e6b" }}>Total Weekly Payment</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#131b2e" }}>{fmtMoney(totalWeekly)}</div>
          </div>
        </div>
        <button
          onClick={() => {
            setAdding(true);
            setEditing(null);
            resetForm();
          }}
          style={{
            background: "#fff",
            border: "1px solid #d8dde6",
            color: "#0070d2",
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

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d8dde6" }}>
        <thead>
          <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
            <th style={th}>Type</th>
            <th style={th}>Creditor</th>
            <th style={th}>Amount</th>
            <th style={th}>Frequency</th>
            <th style={th}>Payment</th>
            <th style={th}>Status</th>
            <th style={{ ...th, width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !showForm && (
            <tr>
              <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
                No debt information entered yet. Click + Add Debt to start.
              </td>
            </tr>
          )}
          {items.map((d) => (
            <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={td}>{label(TYPE_OPTIONS, d.type)}</td>
              <td style={td}>{d.creditorName ?? "—"}</td>
              <td style={td}>{fmtMoney(d.amount)}</td>
              <td style={td}>{label(FREQ_OPTIONS, d.frequency)}</td>
              <td style={td}>{d.paymentAmount != null ? fmtMoney(d.paymentAmount) : "—"}</td>
              <td style={td}>{label(STATUS_OPTIONS, d.status)}</td>
              <td style={td}>
                <button
                  onClick={() => startEdit(d)}
                  title="Edit"
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "#0070d2", marginRight: 6 }}
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
            <tr style={{ background: "#fafaf9", borderTop: "1px solid #d8dde6" }}>
              <td style={td}>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                  {TYPE_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <input
                  value={form.creditorName}
                  onChange={(e) => setForm({ ...form, creditorName: e.target.value })}
                  placeholder="e.g. OnDeck"
                  style={inputStyle}
                />
              </td>
              <td style={td}>
                <input
                  type="number"
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </td>
              <td style={td}>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} style={inputStyle}>
                  {FREQ_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </td>
              <td style={td}>
                <input
                  type="number"
                  step="any"
                  value={form.paymentAmount}
                  onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
                  placeholder="optional"
                  style={inputStyle}
                />
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
                    disabled={saving || !form.amount}
                    style={{
                      background: "#0070d2",
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
                      color: "#3e3e3c",
                      border: "1px solid #d8dde6",
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
        <tfoot>
          <tr style={{ borderTop: "1px solid #d8dde6", background: "#fafaf9" }}>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={td} />
            <td style={{ ...td, fontWeight: 700 }}>{fmtMoney(total)}</td>
            <td style={td} />
            <td style={{ ...td, fontWeight: 700 }}>{fmtMoney(totalWeekly)}</td>
            <td style={td} />
            <td style={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
