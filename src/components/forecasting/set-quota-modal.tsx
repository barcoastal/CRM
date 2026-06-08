"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = { id: string; name: string };

export function SetQuotaModal({
  open,
  onClose,
  defaultUserId,
  defaultPeriod,
  users,
}: {
  open: boolean;
  onClose: () => void;
  defaultUserId: string;
  defaultPeriod: string;
  users: UserOption[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(defaultUserId);
  const [period, setPeriod] = useState(defaultPeriod);
  const [amount, setAmount] = useState("25000");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUserId(defaultUserId);
      setPeriod(defaultPeriod);
      setErr(null);
    }
  }, [open, defaultUserId, defaultPeriod]);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/forecasting/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, period, amount: parseFloat(amount) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 8,
          width: "min(440px, 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 20px",
            borderBottom: "1px solid #ecebea",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#080707", flex: 1, margin: 0 }}>
            Set Quota
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: 0,
              fontSize: 20,
              cursor: "pointer",
              color: "#706e6b",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Rep
            </span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={inp}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Period
            </span>
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-06 or 2026-Q2"
              style={inp}
            />
            <span style={{ fontSize: 11, color: "#706e6b" }}>
              Use YYYY-MM for monthly, YYYY-Qn for quarterly.
            </span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Amount (USD)
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inp}
            />
          </label>

          {err && (
            <div style={{ fontSize: 12, color: "#c23934", background: "#fff1f0", padding: 8, borderRadius: 4 }}>
              {err}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 20px",
            borderTop: "1px solid #ecebea",
          }}
        >
          <button onClick={onClose} style={btnGhost} disabled={saving}>
            Cancel
          </button>
          <button onClick={submit} style={btnPrimary} disabled={saving}>
            {saving ? "Saving..." : "Save Quota"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  outline: "none",
  background: "#fff",
};

const btnPrimary: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  border: 0,
  borderRadius: 4,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "#fff",
  color: "#3052ff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
