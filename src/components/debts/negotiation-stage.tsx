"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Path } from "@/components/slds/path";
import { Button } from "@/components/ui/button";
import { NEGOTIATION_STAGES, STAGE_GUIDANCE, negotiationStage, type NegotiationStage } from "@/lib/negotiation-workflow";

export function NegotiationStageControl({ opportunityId, debtId, value, debtStatus }: { opportunityId: string; debtId: string; value: string | null; debtStatus: string }) {
  const router = useRouter();
  const current = negotiationStage(value, debtStatus);
  const [stage, setStage] = useState<NegotiationStage | "">(current ?? "");
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const currentIndex = current ? NEGOTIATION_STAGES.indexOf(current) : -1;
  const nextStage = currentIndex >= 0 ? NEGOTIATION_STAGES[currentIndex + 1] : undefined;
  async function save(target: NegotiationStage | "" = stage) {
    if (!target || saving) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/debts/${debtId}/negotiation-stage`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: target, previousStatus: value, notes }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "Unable to update stage. Please try again."); }
      setEditing(false); setStage(target); setNotes(""); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update stage."); }
    finally { setSaving(false); }
  }
  return <section className="ng-workflow">
    <div className="ng-path-scroll"><div className="ng-path-inner">
      <Path stages={NEGOTIATION_STAGES.map((label) => ({ label }))} currentIndex={currentIndex} doneVariant="green" currentColor={current === "Settled" ? "#2e844a" : "#032d60"} actionLabel={saving ? "Saving…" : current === "Settled" ? "Completed" : "Mark Stage Complete"} onAction={!saving && nextStage ? () => { void save(nextStage); } : undefined} />
    </div></div>
    <div className="ng-guidance"><p>{current ? STAGE_GUIDANCE[current] : `Recorded stage: ${value}`}</p><button type="button" className="ng-text-button" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Change stage"}</button></div>
    {editing && <div className="ng-stage-editor">
      <label>Move to stage<select value={stage} disabled={saving} onChange={(event) => { setStage(event.target.value as NegotiationStage); setSaved(false); }}><option value="" disabled>Select a stage</option>{NEGOTIATION_STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Note (optional)<input value={notes} disabled={saving} maxLength={5000} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for this change" /></label>
      <Button disabled={saving || !stage || stage === current} onClick={() => { void save(); }}>{saving ? "Saving…" : "Save stage"}</Button>
    </div>}
    {error && <p role="alert" className="ng-error">{error}</p>}
    {saved && <p role="status" className="ng-success">Stage updated.</p>}
  </section>;
}
