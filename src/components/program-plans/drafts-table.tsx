"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

/**
 * Operational drafts table for a Program Plan - the flexible-payments surface:
 * Skip (push the rest), Edit amount (rebalance the rest), Charge Now (manual
 * draft, next business day). Splits render grouped; every mutation flags
 * "pending sync" until the processor client drains it.
 */
export interface DraftRow {
  id: string;
  scheduledDate: string; // ISO
  amount: number;
  status: string;
  attemptNumber: number;
  maxAttempts: number;
  returnCode: string | null;
  kind: string;
  splitGroupId: string | null;
  splitIndex: number | null;
  processorSyncStatus: string;
}

const PENDING = ["SCHEDULED", "RETRYING"];

function draftTone(status: string): ReturnType<typeof genericTone> {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status === "SKIPPED" || status === "CANCELLED") return "warning";
  return genericTone(status);
}

export function DraftsTable({ programPlanId, drafts }: { programPlanId: string; drafts: DraftRow[] }) {
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setMenuFor(null);
      setEditFor(null);
    }
  }

  const skip = (id: string) =>
    call(`/api/drafts/${id}/skip`, { method: "POST" }, "Payment skipped - remaining schedule pushed");
  const saveAmount = (id: string) =>
    call(`/api/drafts/${id}/amount`, { method: "PATCH", body: JSON.stringify({ amount: Number(editAmount) }) }, "Amount updated - remaining payments rebalanced");
  const chargeNow = () =>
    call(`/api/program-plans/${programPlanId}/manual-charge`, { method: "POST", body: JSON.stringify({ amount: Number(chargeAmount) }) }, "Manual charge scheduled for the next business day");

  const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#444444" };
  const td: React.CSSProperties = { padding: "6px 8px", fontSize: 13, color: "#181818" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 8 }}>
        {chargeOpen ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              type="number"
              step="any"
              placeholder="Amount"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              style={{ width: 120, height: 30, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13 }}
            />
            <button onClick={chargeNow} disabled={busy || !(Number(chargeAmount) > 0)} style={btnPrimary}>
              Charge
            </button>
            <button onClick={() => setChargeOpen(false)} style={btn}>Cancel</button>
          </span>
        ) : (
          <button onClick={() => setChargeOpen(true)} style={btn}>Charge Now</button>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ecebea" }}>
            <th style={th}>Scheduled</th>
            <th style={{ ...th, textAlign: "right" }}>Amount</th>
            <th style={th}>Status</th>
            <th style={th}>Sync</th>
            <th style={th}>Attempt</th>
            <th style={th}>Return Code</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const pending = PENDING.includes(d.status);
            const isEditing = editFor === d.id;
            return (
              <tr
                key={d.id}
                style={{
                  borderBottom: "1px solid #f3f3f3",
                  background: d.splitGroupId ? "#fff6e8" : d.kind === "MANUAL" ? "#eef7ff" : undefined,
                  opacity: d.status === "SKIPPED" ? 0.55 : 1,
                }}
              >
                <td style={td}>
                  <Link href={`/drafts/${d.id}`} style={{ color: "#0176d3" }}>
                    {new Date(d.scheduledDate).toLocaleDateString()}
                  </Link>
                  {d.splitGroupId && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#8a4b00", background: "#ffe8c2", borderRadius: 8, padding: "1px 6px" }}>
                      split {Number(d.splitIndex ?? 0) + 1}
                    </span>
                  )}
                  {d.kind === "MANUAL" && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#014486", background: "#d8edff", borderRadius: 8, padding: "1px 6px" }}>
                      manual
                    </span>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {isEditing ? (
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <input
                        type="number"
                        step="any"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        style={{ width: 110, height: 28, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12 }}
                        autoFocus
                      />
                      <button onClick={() => void saveAmount(d.id)} disabled={busy} style={btnPrimary}>Save</button>
                      <button onClick={() => setEditFor(null)} style={btn}>Cancel</button>
                    </span>
                  ) : (
                    `$${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </td>
                <td style={td}><StatusPill label={d.status} tone={draftTone(d.status)} /></td>
                <td style={td}>
                  {d.processorSyncStatus === "PENDING" ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#8a6d00", background: "#fff8e1", borderRadius: 8, padding: "1px 6px" }}>pending sync</span>
                  ) : d.processorSyncStatus === "SYNCED" ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#2e844a" }}>synced</span>
                  ) : (
                    <span style={{ fontSize: 10, color: "#747474" }}>-</span>
                  )}
                </td>
                <td style={td}>{d.attemptNumber}/{d.maxAttempts}</td>
                <td style={td}>{d.returnCode ?? "-"}</td>
                <td style={{ ...td, position: "relative", width: 40 }}>
                  {pending && !isEditing && (
                    <>
                      <button
                        onClick={() => setMenuFor((c) => (c === d.id ? null : d.id))}
                        style={{ border: "1px solid #c9c9c9", background: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
                        aria-label="Draft actions"
                      >
                        ▾
                      </button>
                      {menuFor === d.id && (
                        <div style={{ position: "absolute", right: 4, top: "100%", zIndex: 20, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", minWidth: 140 }}>
                          <button style={menuItem} onClick={() => { setEditFor(d.id); setEditAmount(String(d.amount)); setMenuFor(null); }}>
                            Edit amount
                          </button>
                          <button
                            style={{ ...menuItem, color: "#c23934" }}
                            onClick={() => { if (confirm("Skip this payment and push the remaining schedule forward one week?")) void skip(d.id); }}
                          >
                            Skip payment
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const btn: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", color: "#0176d3", padding: "0 12px", height: 30, borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "#0176d3", color: "#fff", borderColor: "#0176d3" };
const menuItem: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: 0, cursor: "pointer", fontSize: 13, color: "#181818" };
