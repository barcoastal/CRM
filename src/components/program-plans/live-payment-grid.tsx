"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Live payment management grid - the SF account payment calculator, backed by
 * real drafts. Same columns as Salesforce: Payment Date, Weekly Draft Amount,
 * fee split (program/retainer/setup/bank/service/citadel), Escrow, Running
 * Balance (cumulative escrow), Status. Completed/NSF rows are read-only;
 * scheduled rows get Edit Amount / Edit Date / Skip; Charge Now on top.
 */
export interface LiveDraftRow {
  id: string;
  scheduledDate: string; // ISO
  amount: number;
  status: string;
  feeProgram: number;
  feeRetainer: number;
  feeSetup: number;
  feeBank: number;
  feeService: number;
  feeLegal: number;
  escrowAmount: number;
  kind: string;
  splitGroupId: string | null;
  splitIndex: number | null;
  processorSyncStatus: string;
}

const PENDING = ["SCHEDULED", "RETRYING"];

/** SF status labels: SUCCESS -> Completed, FAILED -> NSF (red), etc. */
function sfStatus(s: string): { label: string; color: string } {
  switch (s) {
    case "SUCCESS": return { label: "Completed", color: "#2e844a" };
    case "FAILED": return { label: "NSF", color: "#c23934" };
    case "SKIPPED": return { label: "Skipped", color: "#c23934" };
    case "CANCELLED": return { label: "Cancelled", color: "#747474" };
    case "PROCESSING": return { label: "Processing", color: "#0176d3" };
    case "RETRYING": return { label: "Retrying", color: "#8a4b00" };
    // SF grid vocabulary: future drafts read "Pending".
    default: return { label: "Pending", color: "#747474" };
  }
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LivePaymentGrid({ programPlanId, drafts }: { programPlanId: string; drafts: LiveDraftRow[] }) {
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editKind, setEditKind] = useState<"amount" | "date">("amount");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [splitFor, setSplitFor] = useState<LiveDraftRow | null>(null);
  const [splitParts, setSplitParts] = useState<Array<{ date: string; amount: string }>>([]);
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
  const saveDate = (id: string) =>
    call(`/api/drafts/${id}/date`, { method: "PATCH", body: JSON.stringify({ date: editDate }) }, "Payment date moved");
  const chargeNow = () =>
    call(`/api/program-plans/${programPlanId}/manual-charge`, { method: "POST", body: JSON.stringify({ amount: Number(chargeAmount) }) }, "Manual charge scheduled for the next business day");

  function openSplit(d: LiveDraftRow) {
    const half = Math.round((d.amount / 2) * 100) / 100;
    const d1 = d.scheduledDate.slice(0, 10);
    const next = new Date(d.scheduledDate);
    next.setDate(next.getDate() + 7);
    setSplitParts([
      { date: d1, amount: half.toFixed(2) },
      { date: next.toISOString().slice(0, 10), amount: (d.amount - half).toFixed(2) },
    ]);
    setSplitFor(d);
    setMenuFor(null);
  }

  const splitSum = splitParts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const splitOk = splitFor != null && Math.abs(splitSum - splitFor.amount) < 0.01 && splitParts.every((p) => p.date && Number(p.amount) > 0);

  const saveSplit = () => {
    if (!splitFor) return;
    void call(
      `/api/drafts/${splitFor.id}/split`,
      { method: "POST", body: JSON.stringify({ parts: splitParts.map((p) => ({ date: p.date, amount: Number(p.amount) })) }) },
      "Payment split",
    ).then(() => setSplitFor(null));
  };

  // Running balance = cumulative escrow, SF-style (skipped/cancelled excluded).
  let run = 0;
  const withBalance = drafts.map((d) => {
    if (d.status !== "SKIPPED" && d.status !== "CANCELLED" && d.status !== "FAILED") {
      run = Math.round((run + d.escrowAmount) * 100) / 100;
    }
    return { ...d, _running: run };
  });

  const totals = drafts.reduce(
    (t, d) => {
      if (d.status === "SKIPPED" || d.status === "CANCELLED") return t;
      t.amount += d.amount; t.program += d.feeProgram; t.retainer += d.feeRetainer;
      t.setup += d.feeSetup; t.bank += d.feeBank; t.service += d.feeService;
      t.citadel += d.feeLegal; t.escrow += d.escrowAmount;
      return t;
    },
    { amount: 0, program: 0, retainer: 0, setup: 0, bank: 0, service: 0, citadel: 0, escrow: 0 },
  );

  const td: React.CSSProperties = { padding: "8px 10px", whiteSpace: "nowrap" };

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
            <button onClick={chargeNow} disabled={busy || !(Number(chargeAmount) > 0)} style={btnPrimary}>Charge</button>
            <button onClick={() => setChargeOpen(false)} style={btn}>Cancel</button>
          </span>
        ) : (
          <button onClick={() => setChargeOpen(true)} style={btn}>Charge Now</button>
        )}
      </div>
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
              {["Payment Date", "Weekly Draft Amount", "Program Fee", "Retainer Fee", "Setup Fee", "Bank Fee", "Service Fee", "Citadel Fee", "Escrow Amount", "Running Balance", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, fontSize: 11, color: "#444444", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withBalance.map((d) => {
              const pending = PENDING.includes(d.status);
              const s = sfStatus(d.status);
              const nsf = d.status === "FAILED";
              const isEditing = editFor === d.id;
              return (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: "1px solid #f3f3f3",
                    background: d.splitGroupId ? "#fff6e8" : d.kind === "MANUAL" ? "#eef7ff" : undefined,
                    color: nsf ? "#c23934" : "#181818",
                    opacity: d.status === "SKIPPED" || d.status === "CANCELLED" ? 0.55 : 1,
                  }}
                >
                  <td style={td}>
                    {isEditing && editKind === "date" ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          style={{ height: 28, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12 }}
                          autoFocus
                        />
                        <button onClick={() => void saveDate(d.id)} disabled={busy} style={btnPrimary}>Save</button>
                        <button onClick={() => setEditFor(null)} style={btn}>Cancel</button>
                      </span>
                    ) : (
                      <>
                        {new Date(d.scheduledDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
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
                        {d.processorSyncStatus === "PENDING" && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#8a6d00", background: "#fff8e1", borderRadius: 8, padding: "1px 6px" }}>
                            pending sync
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td style={td}>
                    {isEditing && editKind === "amount" ? (
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
                      money(d.amount)
                    )}
                  </td>
                  <td style={td}>{money(d.feeProgram)}</td>
                  <td style={td}>{money(d.feeRetainer)}</td>
                  <td style={td}>{money(d.feeSetup)}</td>
                  <td style={td}>{money(d.feeBank)}</td>
                  <td style={td}>{money(d.feeService)}</td>
                  <td style={td}>{money(d.feeLegal)}</td>
                  <td style={td}>{money(d.escrowAmount)}</td>
                  <td style={td}>{money(d._running)}</td>
                  <td style={{ ...td, color: s.color, fontWeight: nsf ? 700 : 400 }}>{s.label}</td>
                  <td style={{ ...td, position: "relative", width: 40 }}>
                    {pending && !isEditing && (
                      <>
                        <button
                          onClick={() => setMenuFor((c) => (c === d.id ? null : d.id))}
                          aria-label="Row actions"
                          style={{ border: "1px solid #c9c9c9", background: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
                        >
                          ▾
                        </button>
                        {menuFor === d.id && (
                          <div style={{ position: "absolute", right: 4, top: "100%", zIndex: 20, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", minWidth: 140 }}>
                            <button style={menuItem} onClick={() => { setEditKind("amount"); setEditFor(d.id); setEditAmount(String(d.amount)); setMenuFor(null); }}>
                              Edit amount
                            </button>
                            <button style={menuItem} onClick={() => { setEditKind("date"); setEditFor(d.id); setEditDate(d.scheduledDate.slice(0, 10)); setMenuFor(null); }}>
                              Edit date
                            </button>
                            <button style={menuItem} onClick={() => openSplit(d)}>
                              Split payment
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
          <tfoot>
            <tr style={{ borderTop: "2px solid #c9c9c9", fontWeight: 700, background: "#fafaf9" }}>
              <td style={td}>Totals</td>
              <td style={td}>{money(totals.amount)}</td>
              <td style={td}>{money(totals.program)}</td>
              <td style={td}>{money(totals.retainer)}</td>
              <td style={td}>{money(totals.setup)}</td>
              <td style={td}>{money(totals.bank)}</td>
              <td style={td}>{money(totals.service)}</td>
              <td style={td}>{money(totals.citadel)}</td>
              <td style={td}>{money(totals.escrow)}</td>
              <td style={td} colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {splitFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 20, width: 420, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#181818", marginBottom: 4 }}>Split Payment</div>
            <div style={{ fontSize: 12, color: "#444444", marginBottom: 12 }}>
              {new Date(splitFor.scheduledDate).toLocaleDateString()} · {money(splitFor.amount)} - parts must add up exactly. Weekly fees stay on part 1.
            </div>
            {splitParts.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#444444", width: 38 }}>#{i + 1}</span>
                <input
                  type="date"
                  value={p.date}
                  onChange={(e) => setSplitParts((ps) => ps.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                  style={{ height: 30, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12, flex: 1 }}
                />
                <input
                  type="number"
                  step="any"
                  value={p.amount}
                  onChange={(e) => setSplitParts((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  style={{ width: 110, height: 30, padding: "0 6px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 12 }}
                />
                {splitParts.length > 2 && (
                  <button
                    onClick={() => setSplitParts((ps) => ps.filter((_, j) => j !== i))}
                    style={{ border: 0, background: "none", color: "#c23934", cursor: "pointer", fontSize: 15 }}
                    aria-label="Remove part"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const last = splitParts[splitParts.length - 1];
                const d = new Date(last?.date || splitFor.scheduledDate);
                d.setDate(d.getDate() + 7);
                setSplitParts((ps) => [...ps, { date: d.toISOString().slice(0, 10), amount: "0" }]);
              }}
              style={{ ...btn, height: 28, fontSize: 12, marginBottom: 12 }}
            >
              + Add part
            </button>
            <div style={{ fontSize: 12, marginBottom: 12, color: splitOk ? "#2e844a" : "#c23934", fontWeight: 600 }}>
              Parts total {money(splitSum)} of {money(splitFor.amount)}
              {!splitOk && ` - off by ${money(Math.abs(splitSum - splitFor.amount))}`}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setSplitFor(null)} style={btn}>Cancel</button>
              <button onClick={saveSplit} disabled={!splitOk || busy} style={{ ...btnPrimary, opacity: splitOk ? 1 : 0.5 }}>
                Split
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", color: "#0176d3", padding: "0 12px", height: 30, borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "#0176d3", color: "#fff", borderColor: "#0176d3" };
const menuItem: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "transparent", border: 0, cursor: "pointer", fontSize: 13, color: "#181818" };
