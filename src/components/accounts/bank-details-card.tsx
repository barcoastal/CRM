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
  color: "#444444",
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
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        style={{
          background: "#fafaf9",
          borderBottom: "1px solid #c9c9c9",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            background: "#9b6cb1",
            color: "#fff",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
            <path d="M26 4L4 14v3h44v-3L26 4zM6 19v23h6V19H6zm10 0v23h6V19h-6zm10 0v23h6V19h-6zm10 0v23h6V19h-6zM4 44v4h44v-4H4z" />
          </svg>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Bank Details
        </h3>
      </header>
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
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
              background: "#fff",
              color: "#0176d3",
              border: "1px solid #c9c9c9",
              padding: "0 16px",
              height: 28,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 400,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </article>
  );
}
