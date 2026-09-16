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
      setStage(target); setNotes(""); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update stage."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 rounded border bg-gray-50 p-4">
    <h3 className="text-sm font-semibold">Debt negotiation workflow</h3>
    <div className="overflow-x-auto"><div className="min-w-[900px]">
      <Path stages={NEGOTIATION_STAGES.map((label) => ({ label }))} currentIndex={currentIndex} doneVariant="green" currentColor={current === "Settled" ? "#2e844a" : "#032d60"} actionLabel={saving ? "Saving…" : current === "Settled" ? "Completed" : "Mark Stage Complete"} onAction={!saving && nextStage ? () => { void save(nextStage); } : undefined} />
    </div></div>
    <p className="text-sm">Current stage: <strong>{current ?? value}</strong></p>
    {value && value !== current && <p className="text-xs text-muted-foreground">Existing negotiation status: {value}</p>}
    {current && <p className="text-sm text-muted-foreground">{STAGE_GUIDANCE[current]}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span className="block">Move to stage</span><select value={stage} disabled={saving} onChange={(event) => { setStage(event.target.value as NegotiationStage); setSaved(false); }} className="w-full rounded border bg-white p-2"><option value="" disabled>Select a stage</option>{NEGOTIATION_STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span className="block">Stage change note (optional)</span><input value={notes} disabled={saving} maxLength={5000} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border bg-white p-2" placeholder="What changed or needs to happen next?" /></label>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {saved && <p role="status" className="text-sm text-green-700">Stage updated.</p>}
    <Button disabled={saving || !stage || stage === current} onClick={() => { void save(); }}>{saving ? "Saving…" : "Update stage"}</Button>
  </section>;
}
