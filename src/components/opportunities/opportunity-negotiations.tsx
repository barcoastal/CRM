"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { NegotiationTimeline } from "@/components/debts/negotiation-timeline";

type Debt = {
  id: string;
  creditorName: string;
  accountNumber: string | null;
  currentBalance: number;
  status: string;
  negotiations: ComponentProps<typeof NegotiationTimeline>["negotiations"];
};

export function OpportunityNegotiations({ opportunityId, debts }: { opportunityId: string; debts: Debt[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const debt = debts.find((item) => item.id === selectedId) ?? debts[0];
  if (!debt) return <p className="p-4 text-sm text-muted-foreground">Add a debt in Debt Information to start recording negotiations.</p>;
  return (
    <div className="space-y-4 p-2">
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
      <NegotiationTimeline key={debt.id} opportunityId={opportunityId} debtId={debt.id} negotiations={debt.negotiations} onRefresh={() => router.refresh()} />
    </div>
  );
}
