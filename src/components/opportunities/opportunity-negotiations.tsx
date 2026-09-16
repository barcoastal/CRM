"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { NegotiationStageControl } from "@/components/debts/negotiation-stage";
import { negotiationStage } from "@/lib/negotiation-workflow";
import { NegotiationTimeline } from "@/components/debts/negotiation-timeline";

type Debt = {
  id: string;
  creditorName: string;
  accountNumber: string | null;
  currentBalance: number;
  status: string;
  negotiationStatus?: string | null;
  negotiations: ComponentProps<typeof NegotiationTimeline>["negotiations"];
};

export function OpportunityNegotiations({ opportunityId, debts }: { opportunityId: string; debts: Debt[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const debt = debts.find((item) => item.id === selectedId) ?? debts[0];
  if (!debt) return <p className="p-4 text-sm text-muted-foreground">Add a debt in Debt Information to start recording negotiations.</p>;
  return (
    <div className="space-y-4 p-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {debts.map((item) => <button key={item.id} type="button" aria-pressed={item.id === debt.id} onClick={() => setSelectedId(item.id)} className={`rounded border p-3 text-left ${item.id === debt.id ? "border-blue-600 bg-blue-50" : "bg-white"}`}><span className="block text-sm font-semibold">{item.creditorName}</span><span className="text-xs text-muted-foreground">{negotiationStage(item.negotiationStatus, item.status) ?? item.negotiationStatus}</span></button>)}
      </div>
      <div className="space-y-1">
        <label htmlFor="negotiation-creditor" className="text-sm font-medium">Creditor</label>
        <select id="negotiation-creditor" className="w-full rounded-md border bg-background p-2 text-sm" value={debt.id} onChange={(event) => setSelectedId(event.target.value)}>
          {debts.map((item) => <option key={item.id} value={item.id}>{item.creditorName}{item.accountNumber ? ` • Ending ${item.accountNumber.slice(-4)}` : ""}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Balance: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(debt.currentBalance)}</span>
        <span>Status: {debt.status.replace(/_/g, " ")}</span>
      </div>
      <NegotiationStageControl key={`${debt.id}:${debt.negotiationStatus ?? ""}`} opportunityId={opportunityId} debtId={debt.id} value={debt.negotiationStatus ?? null} debtStatus={debt.status} />
      <NegotiationTimeline key={debt.id} opportunityId={opportunityId} debtId={debt.id} negotiations={debt.negotiations} onRefresh={() => router.refresh()} />
    </div>
  );
}
