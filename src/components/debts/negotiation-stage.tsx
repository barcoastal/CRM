"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  async function save() {
    if (!stage || saving) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/debts/${debtId}/negotiation-stage`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, previousStatus: value, notes }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "Unable to update stage. Please try again."); }
      setNotes(""); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update stage."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 rounded border bg-gray-50 p-4">
    <h3 className="text-sm font-semibold">Debt negotiation workflow</h3>
    <ol className="grid grid-cols-2 gap-2 lg:grid-cols-6" aria-label="Negotiation stages">
      {NEGOTIATION_STAGES.map((item, index) => <li key={item} aria-current={current === item ? "step" : undefined} className={`rounded border p-3 text-xs ${current === item ? "border-blue-600 bg-blue-600 font-semibold text-white" : "bg-white text-gray-600"}`}><span className="mb-1 block">{index + 1}</span>{item}</li>)}
    </ol>
    <p className="text-sm">Current stage: <strong>{current ?? value}</strong></p>
    {value && value !== current && <p className="text-xs text-muted-foreground">Existing negotiation status: {value}</p>}
    {current && <p className="text-sm text-muted-foreground">{STAGE_GUIDANCE[current]}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span className="block">Move to stage</span><select value={stage} disabled={saving} onChange={(event) => { setStage(event.target.value as NegotiationStage); setSaved(false); }} className="w-full rounded border bg-white p-2"><option value="" disabled>Select a stage</option>{NEGOTIATION_STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span className="block">Stage change note (optional)</span><input value={notes} disabled={saving} maxLength={5000} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border bg-white p-2" placeholder="What changed or needs to happen next?" /></label>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {saved && <p role="status" className="text-sm text-green-700">Stage updated.</p>}
    <Button disabled={saving || !stage || stage === current} onClick={save}>{saving ? "Saving…" : "Update stage"}</Button>
  </section>;
}
