"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { NegotiationOfferCalculator } from "@/components/debts/negotiation-offer-calculator";
import { NegotiationEmail, type NegotiationEmailMessage } from "@/components/debts/negotiation-email";
import { NegotiationStageControl } from "@/components/debts/negotiation-stage";
import { negotiationStage } from "@/lib/negotiation-workflow";
import { NegotiationTimeline } from "@/components/debts/negotiation-timeline";

type Document = { origin?: string; id: string; name: string; type: string; fileSize: number | null; createdAt: string };
type Debt = {
  originalBalance?: number; enrolledBalance?: number; creditorPhone?: string | null; debtType?: string | null; paymentAmount?: number | null; paymentFrequency?: string | null; legalStatus?: string | null; lienPosition?: string | null; isDelinquent?: boolean; notes?: string | null; settledAmount?: number | null; sourceDocument?: Document | null;
  offers?: { id: string; amountOffered: number; percentOffered: number; status: string; termsNotes: string | null; createdAt: string; counterAmount: number | null }[];
  id: string; creditorName: string; creditorEmail?: string | null; accountNumber: string | null;
  currentBalance: number; status: string; negotiationStatus?: string | null;
  negotiations: ComponentProps<typeof NegotiationTimeline>["negotiations"];
};
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function OpportunityNegotiations({ opportunityId, debts, opportunityName = "Opportunity", canEmail = false, senderEmail = "", emails = [], documents = [], canCreateOffer = false }: { opportunityId: string; debts: Debt[]; opportunityName?: string; canEmail?: boolean; senderEmail?: string; emails?: NegotiationEmailMessage[]; documents?: Document[]; canCreateOffer?: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("Overview");
  const [offerDraft, setOfferDraft] = useState<{ debtId: string; body: string; token: number } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const debt = debts.find((item) => item.id === selectedId) ?? debts[0];
  if (!debt) return <div className="ng-empty">Add a debt to the opportunity to start negotiations.</div>;
  const relatedDocs = [...(debt.sourceDocument ? [debt.sourceDocument] : []), ...documents.filter(doc => doc.id !== debt.sourceDocument?.id)];
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
      <div className="ng-tabs" role="tablist" aria-label="Debt workspace">{["Overview", ...(canEmail ? ["Emails"] : []), "Activity", "Documents", "Debt details"].map((name) => <button id={`ng-tab-${name.replace(" ", "-")}`} role="tab" aria-selected={tab === name} aria-controls={`ng-panel-${name.replace(" ", "-")}`} key={name} onClick={() => setTab(name)}>{name}{name === "Emails" && emails.length > 0 && <span>{emails.length}</span>}</button>)}</div>
      <div className="ng-tab-content ng-overview" id="ng-panel-Overview" role="tabpanel" aria-labelledby="ng-tab-Overview" hidden={tab !== "Overview"}>
        <div className="ng-overview-grid"><div className="ng-context-stack">
          <section className="ng-card"><div className="ng-card-heading"><h3>Debt snapshot</h3><span className={`ng-status ${debt.status === "SETTLED" ? "is-settled" : ""}`}>{debt.status.replace(/_/g, " ")}</span></div><dl className="ng-detail-grid">
          {[["Original balance", debt.originalBalance == null ? "—" : money(debt.originalBalance)], ["Enrolled balance", debt.enrolledBalance == null ? "—" : money(debt.enrolledBalance)], ["Debt type", debt.debtType?.replace(/_/g, " ") || "Not recorded"], ["Scheduled payment", debt.paymentAmount == null ? "Not recorded" : `${money(debt.paymentAmount)} · ${(debt.paymentFrequency || "frequency not recorded").replace(/_/g, " ")}`], ["Creditor phone", debt.creditorPhone || "Not provided"], ["Legal status", debt.legalStatus || "Not recorded"], ["Lien position", debt.lienPosition || "Not recorded"], ["Delinquent", debt.isDelinquent ? "Yes" : "No"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          {debt.settledAmount != null && <div><dt>Recorded settlement</dt><dd>{money(debt.settledAmount)}</dd></div>}</dl>{debt.notes && <div className="ng-record-note"><strong>Debt notes</strong><p>{debt.notes}</p></div>}</section>
          <section className="ng-card"><div className="ng-card-heading"><h3>Supporting documents <span className="ng-count">{relatedDocs.length}</span></h3><button className="ng-text-button" onClick={() => setTab("Documents")}>View all</button></div>{relatedDocs.length ? <ul className="ng-doc-list">{relatedDocs.slice(0, 4).map(doc => <li key={doc.id}><span className="ng-file-icon">▤</span><div><a href={`/api/opportunities/${opportunityId}/negotiation-documents/${doc.id}?view=1`} target="_blank" rel="noopener noreferrer">{doc.name}</a><small>{doc.id === debt.sourceDocument?.id ? "Source contract · " : `${doc.origin || "Opportunity"} · `}{doc.type.replace(/_/g, " ")}</small></div><a className="ng-text-button" href={`/api/opportunities/${opportunityId}/negotiation-documents/${doc.id}`}>Download</a></li>)}</ul> : <p className="ng-muted">No documents are attached to this opportunity or debt.</p>}<a className="ng-text-button" href={`/opportunities/${opportunityId}`} target="_blank" rel="noopener noreferrer">Manage opportunity files ↗</a></section>
        </div><NegotiationOfferCalculator key={debt.id} opportunityId={opportunityId} debtId={debt.id} balance={debt.currentBalance} creditorName={debt.creditorName} opportunityName={opportunityName} accountNumber={debt.accountNumber} canSave={canCreateOffer} canEmail={canEmail} onDraft={body => { setOfferDraft({ debtId: debt.id, body, token: (offerDraft?.token ?? 0) + 1 }); setTab("Emails"); setEmailOpen(true); }} /></div>
        <section className="ng-card ng-saved-offers"><div className="ng-card-heading"><h3>Offer history <span className="ng-count">{debt.offers?.length ?? 0}</span></h3><span className="ng-muted">Saved proposals for this debt</span></div>{debt.offers?.length ? <div className="ng-table-scroll"><table className="ng-offers-table"><thead><tr><th>Offer</th><th>Balance %</th><th>Status</th><th>Terms</th><th>Created</th></tr></thead><tbody>{debt.offers.map(offer => <tr key={offer.id}><td><strong>{money(offer.amountOffered)}</strong>{offer.counterAmount != null && <small>Counter: {money(offer.counterAmount)}</small>}</td><td>{(offer.percentOffered * 100).toFixed(1)}%</td><td><span className="ng-status">{offer.status}</span></td><td>{offer.termsNotes || "—"}</td><td>{new Date(offer.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="ng-muted">No offers recorded yet. Use the calculator to prepare the first proposal.</p>}</section>
      </div>
      <div className="ng-tab-content" id="ng-panel-Documents" role="tabpanel" aria-labelledby="ng-tab-Documents" hidden={tab !== "Documents"}><div className="ng-panel-heading"><div><h3 className="ng-section-title">Related documents</h3><p>Source contract and related opportunity, account, and lead files.</p></div><a className="ng-button" href={`/opportunities/${opportunityId}`} target="_blank" rel="noopener noreferrer">Manage files ↗</a></div><ul className="ng-doc-list">{relatedDocs.map(doc => <li key={doc.id}><span className="ng-file-icon">▤</span><div><a href={`/api/opportunities/${opportunityId}/negotiation-documents/${doc.id}?view=1`} target="_blank" rel="noopener noreferrer">{doc.name}</a><small>{doc.id === debt.sourceDocument?.id ? "Source contract" : `${doc.origin || "Opportunity"} document`} · {doc.type.replace(/_/g, " ")} · {new Date(doc.createdAt).toLocaleDateString()}{doc.fileSize != null ? ` · ${Math.ceil(doc.fileSize / 1024)} KB` : ""}</small></div><a className="ng-button" href={`/api/opportunities/${opportunityId}/negotiation-documents/${doc.id}`}>Download</a></li>)}</ul>{!relatedDocs.length && <p className="ng-empty">No related documents have been uploaded.</p>}</div>
      <div className="ng-tab-content" id="ng-panel-Activity" role="tabpanel" aria-labelledby="ng-tab-Activity" hidden={tab !== "Activity"}><NegotiationTimeline key={debt.id} opportunityId={opportunityId} debtId={debt.id} negotiations={debt.negotiations} onRefresh={() => router.refresh()} /></div>
      {canEmail && <div className="ng-tab-content" id="ng-panel-Emails" role="tabpanel" aria-labelledby="ng-tab-Emails" hidden={tab !== "Emails"}><NegotiationEmail documents={relatedDocs} offerDraft={offerDraft?.debtId === debt.id ? offerDraft : null} composeOpen={emailOpen} onComposeChange={setEmailOpen} opportunityId={opportunityId} opportunityName={opportunityName} debtId={debt.id} creditorName={debt.creditorName} creditorEmail={debt.creditorEmail ?? null} senderEmail={senderEmail} messages={emails} /></div>}
      <div className="ng-tab-content" id="ng-panel-Debt-details" role="tabpanel" aria-labelledby="ng-tab-Debt-details" hidden={tab !== "Debt details"}><h3 className="ng-section-title">Debt information</h3><dl className="ng-detail-grid"><div><dt>Creditor</dt><dd>{debt.creditorName}</dd></div><div><dt>Debt status</dt><dd>{debt.status.replace(/_/g, " ")}</dd></div><div><dt>Current balance</dt><dd>{money(debt.currentBalance)}</dd></div><div><dt>Recorded negotiation status</dt><dd>{debt.negotiationStatus || "Not started"}</dd></div></dl></div>
    </div>
  </div>;
}
