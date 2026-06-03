"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const input: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
};

const required = <span style={{ color: "#c23934", marginRight: 2 }}>*</span>;

export function BankDetailsCard({
  accountId,
  initial,
}: {
  accountId: string;
  initial: {
    bankName: string | null;
    bankRoutingNumber: string | null;
    bankAccountNumber: string | null;
    bankAccountType: string | null;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    bankName: initial.bankName ?? "",
    bankRoutingNumber: initial.bankRoutingNumber ?? "",
    bankAccountNumber: initial.bankAccountNumber ?? "",
    bankAccountType: initial.bankAccountType ?? "Checking",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/bank-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Bank details saved");
        router.refresh();
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
        Bank Details
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={label}>{required}Bank Name</label>
          <input
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            style={input}
          />
        </div>
        <div>
          <label style={label}>{required}Bank Routing Number</label>
          <input
            value={form.bankRoutingNumber}
            onChange={(e) => setForm({ ...form, bankRoutingNumber: e.target.value })}
            style={input}
          />
        </div>
        <div>
          <label style={label}>{required}Bank Account Number</label>
          <input
            value={form.bankAccountNumber}
            onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
            style={input}
          />
        </div>
        <div>
          <label style={label}>{required}Bank Account Type</label>
          <select
            value={form.bankAccountType}
            onChange={(e) => setForm({ ...form, bankAccountType: e.target.value })}
            style={input}
          >
            <option value="Checking">Checking</option>
            <option value="Savings">Savings</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: "#0070d2",
            color: "#fff",
            border: 0,
            padding: "6px 16px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </article>
  );
}
