"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { MonthlyCloser, ScoreboardTarget } from "@/lib/scoreboard-shared";

export function TargetsEditor({ rows: inputRows, period, onClose, onSaved }: {
  rows: MonthlyCloser[]; period: string; onClose: () => void; onSaved: () => void;
}) {
  // Hold the edit roster steady while the live scoreboard refreshes/reorders.
  const [rows] = useState(inputRows);
  const [draft, setDraft] = useState(() => rows.map(({ userId, debtTarget, contractTarget, firstPaymentDebtTarget }) => ({ userId, debtTarget, contractTarget, firstPaymentDebtTarget })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (userId: string, key: keyof Omit<ScoreboardTarget, "userId">, value: string) => {
    setDraft((old) => old.map((row) => row.userId === userId ? { ...row, [key]: value === "" ? null : Number(value) } : row));
  };
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const changed = draft.filter((row, i) => ["debtTarget", "contractTarget", "firstPaymentDebtTarget"].some((key) => row[key as keyof ScoreboardTarget] !== rows[i][key as keyof ScoreboardTarget]));
      if (!changed.length) { onClose(); return; }
      const response = await fetch("/api/scoreboard/targets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, targets: changed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Goals could not be saved.");
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Goals could not be saved."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sb-goals-dialog" style={{ maxWidth: 880 }}>
      <DialogHeader><DialogTitle>Monthly goals · {period}</DialogTitle><DialogDescription>Set each closer’s goals for this month. Leave a field blank when no goal is set. Client debt eligibility stays in Closer Setup.</DialogDescription></DialogHeader>
      <form onSubmit={save}>
        <div className="sb-goals-scroll"><table className="sb-goals-table"><thead><tr><th>Closer</th><th>Closed debt goal ($)</th><th>Signed contracts</th><th>First payment debt goal ($)</th></tr></thead>
          <tbody>{draft.map((row, i) => <tr key={row.userId}><th>{rows[i].name}</th>
            {(["debtTarget", "contractTarget", "firstPaymentDebtTarget"] as const).map((key) => <td key={key}><input type="number" min="0" max={key === "contractTarget" ? 1_000_000 : 1_000_000_000_000} step={key === "contractTarget" ? "1" : ".01"} value={row[key] ?? ""} placeholder="No goal" aria-label={`${rows[i].name} ${key === "debtTarget" ? "closed debt goal" : key === "contractTarget" ? "signed contract goal" : "first payment debt goal"}`} disabled={busy} onChange={(e) => update(row.userId, key, e.target.value)} /></td>)}
          </tr>)}</tbody></table></div>
        {error && <p className="sb-goals-error" role="alert">{error}</p>}
        <div className="sb-goals-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save monthly goals"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
