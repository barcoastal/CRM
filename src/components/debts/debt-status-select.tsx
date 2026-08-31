"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const LEGAL_STATUS_OPTIONS = [
  "Summons", "Arbitration", "UCC Lien", "Default Judgment", "Summary Judgment", "COJ",
  "Summons/UCC", "Arbitration/UCC", "Active Negotiations/Legal", "Arbitration Award",
  "Judgment", "Active Negotiations/UCC", "Dismissed with Prejudice", "Dismissed w/out Prejudice",
];

export const NEGOTIATION_STATUS_OPTIONS = [
  "Settled PIF", "Settled Payments", "Settled Lump Sum", "Need Correspondence",
  "Waiting for the Settlement Agreement", "Sent to CSR for Client Signature",
  "Counter Signature from Lender", "Declined Offer",
];

/** Inline dropdown on the Debt Details list to set a debt's legalStatus or
 *  negotiationStatus. Saves on change via PATCH /api/debts/[id]. */
export function DebtStatusSelect({
  debtId, field, value, options,
}: {
  debtId: string;
  field: "legalStatus" | "negotiationStatus";
  value: string | null;
  options: readonly string[];
}) {
  const router = useRouter();
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function change(v: string) {
    setVal(v);
    setSaving(true);
    try {
      await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: v || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Keep a current non-standard value visible so nothing is silently dropped.
  const opts = val && !options.includes(val) ? [val, ...options] : options;

  return (
    <select
      value={val}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
      style={{ width: "100%", border: "1px solid #dddbda", borderRadius: 4, padding: "3px 6px", fontSize: 12, background: "#fff", color: "#181818", cursor: "pointer" }}
    >
      <option value="">-</option>
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
