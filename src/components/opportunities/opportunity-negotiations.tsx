"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { NegotiationEmail, type NegotiationEmailMessage } from "@/components/debts/negotiation-email";
import { NegotiationStageControl } from "@/components/debts/negotiation-stage";
import { negotiationStage } from "@/lib/negotiation-workflow";
import { NegotiationTimeline } from "@/components/debts/negotiation-timeline";

type Debt = {
  id: string; creditorName: string; creditorEmail?: string | null; accountNumber: string | null;
  currentBalance: number; status: string; negotiationStatus?: string | null;
  negotiations: ComponentProps<typeof NegotiationTimeline>["negotiations"];
};
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function OpportunityNegotiations({ opportunityId, debts, opportunityName = "Opportunity", canEmail = false, senderEmail = "", emails = [] }: { opportunityId: string; debts: Debt[]; opportunityName?: string; canEmail?: boolean; senderEmail?: string; emails?: NegotiationEmailMessage[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("Activity");
  const [emailOpen, setEmailOpen] = useState(false);
  const debt = debts.find((item) => item.id === selectedId) ?? debts[0];
  if (!debt) return <div className="ng-empty">Add a debt to the opportunity to start negotiations.</div>;
  const stage = negotiationStage(debt.negotiationStatus, debt.status);
  return <div className="ng-workspace">
    <aside className="ng-debts" aria-label="Opportunity debts">
      <div className="ng-debts-heading"><h2>Debts</h2><span>{debts.length}</span></div>
      <p className="ng-debts-total">{money(debts.reduce((sum, item) => sum + item.currentBalance, 0))} total balance</p>
      <div className="ng-debt-list">{debts.map((item, index) => {
        const itemStage = negotiationStage(item.negotiationStatus, item.status);
        return <button key={item.id} type="button" aria-pressed={item.id === debt.id} onClick={() => setSelectedId(item.id)} className={`ng-debt ${item.id === debt.id ? "is-active" : ""}`}>
          <span className="ng-debt-title">{item.creditorName}<span className="ng-debt-chevron">›</span></span>
          <span className="ng-debt-meta">{item.accountNumber ? `Account •••• ${item.accountNumber.slice(-4)}` : `Debt ${index + 1}`}<strong>{money(item.currentBalance)}</strong></span>
          <span className={`ng-status ${itemStage === "Settled" ? "is-settled" : ""}`}>{itemStage ?? item.negotiationStatus}</span>
        </button>;
      })}</div>
    </aside>
    <div className="ng-main">
      <header className="ng-creditor-header">
        <div className="ng-creditor-title"><span className="ng-creditor-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10h18L12 4 3 10Zm2 10h14M7 10v8m5-8v8m5-8v8" /></svg></span><div><span className="ng-eyebrow">Debt negotiation</span><h2>{debt.creditorName}</h2></div></div>
        <div className="ng-header-actions">{canEmail && <button className="ng-button ng-button-brand" onClick={() => { setTab("Emails"); setEmailOpen(true); }}>Email creditor</button>}</div>
      </header>
      <dl className="ng-highlights"><div><dt>Current balance</dt><dd>{money(debt.currentBalance)}</dd></div><div><dt>Negotiation stage</dt><dd>{stage ?? debt.negotiationStatus}</dd></div><div><dt>Account number</dt><dd>{debt.accountNumber ? `•••• ${debt.accountNumber.slice(-4)}` : "Not provided"}</dd></div><div><dt>Creditor email</dt><dd>{debt.creditorEmail || "Not provided"}</dd></div></dl>
      <NegotiationStageControl key={`${debt.id}:${debt.negotiationStatus ?? ""}`} opportunityId={opportunityId} debtId={debt.id} value={debt.negotiationStatus ?? null} debtStatus={debt.status} />
      <div className="ng-tabs" role="tablist" aria-label="Debt workspace">{["Activity", ...(canEmail ? ["Emails"] : []), "Debt details"].map((name) => <button id={`ng-tab-${name.replace(" ", "-")}`} role="tab" aria-selected={tab === name} aria-controls={`ng-panel-${name.replace(" ", "-")}`} key={name} onClick={() => setTab(name)}>{name}{name === "Emails" && emails.length > 0 && <span>{emails.length}</span>}</button>)}</div>
      <div className="ng-tab-content" id="ng-panel-Activity" role="tabpanel" aria-labelledby="ng-tab-Activity" hidden={tab !== "Activity"}><NegotiationTimeline key={debt.id} opportunityId={opportunityId} debtId={debt.id} negotiations={debt.negotiations} onRefresh={() => router.refresh()} /></div>
      {canEmail && <div className="ng-tab-content" id="ng-panel-Emails" role="tabpanel" aria-labelledby="ng-tab-Emails" hidden={tab !== "Emails"}><NegotiationEmail composeOpen={emailOpen} onComposeChange={setEmailOpen} opportunityId={opportunityId} opportunityName={opportunityName} debtId={debt.id} creditorName={debt.creditorName} creditorEmail={debt.creditorEmail ?? null} senderEmail={senderEmail} messages={emails} /></div>}
      <div className="ng-tab-content" id="ng-panel-Debt-details" role="tabpanel" aria-labelledby="ng-tab-Debt-details" hidden={tab !== "Debt details"}><h3 className="ng-section-title">Debt information</h3><dl className="ng-detail-grid"><div><dt>Creditor</dt><dd>{debt.creditorName}</dd></div><div><dt>Debt status</dt><dd>{debt.status.replace(/_/g, " ")}</dd></div><div><dt>Current balance</dt><dd>{money(debt.currentBalance)}</dd></div><div><dt>Recorded negotiation status</dt><dd>{debt.negotiationStatus || "Not started"}</dd></div></dl></div>
    </div>
  </div>;
}
