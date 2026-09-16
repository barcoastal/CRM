"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateOffer } from "@/lib/negotiation-offer";
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function NegotiationOfferCalculator({ opportunityId, debtId, balance, creditorName, opportunityName, accountNumber, canSave, canEmail, onDraft }: { opportunityId: string; debtId: string; balance: number; creditorName: string; opportunityName: string; accountNumber: string | null; canSave: boolean; canEmail: boolean; onDraft: (body: string) => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState("1");
  const [frequency, setFrequency] = useState("Lump sum");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const result = calculateOffer(balance, Number(amount), Number(payments));
  function changeAmount(value: string) { setAmount(value); setSaved(false); setNotice(""); }
  async function save() {
    if (!result || busy || saved) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/debts/${debtId}/offers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: result.amount, payments: Number(payments), frequency, notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save offer.");
      setSaved(true); setNotice("Offer saved to this debt. It has not been sent."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save offer."); }
    finally { setBusy(false); }
  }
  function draft() {
    if (!result) return;
    onDraft(`Hello,\n\nRegarding ${opportunityName} — ${creditorName}${accountNumber ? `, account ending ${accountNumber.slice(-4)}` : ""}:\n\nWe would like to propose ${money(result.amount)} to settle the recorded balance of ${money(balance)} (${result.percent.toFixed(2)}% of the balance).\n\n${Number(payments) === 1 ? "Payment: one lump sum." : `Payment proposal: ${payments} ${frequency.toLowerCase()} installments; ${Number(payments) - 1} of ${money(result.payment)} and a final payment of ${money(result.finalPayment)}.`}\n${notes ? `\n${notes}\n` : ""}\nPlease confirm whether this proposal is acceptable and provide the written settlement terms for review.\n\nThank you.`);
  }
  return <section className="ng-card ng-calculator"><div className="ng-card-heading"><div><span className="ng-eyebrow">Build a proposal</span><h3>Offer calculator</h3></div><span className="ng-muted">Balance {money(balance)}</span></div>
    <div className="ng-calc-presets">{[30,40,50,60].map(p => <button key={p} type="button" onClick={() => changeAmount((balance * p / 100).toFixed(2))}>{p}%</button>)}<span>Quick calculations</span></div>
    <div className="ng-calc-fields"><label>Settlement amount ($)<input type="number" min="0.01" max={balance} step="0.01" value={amount} placeholder="Enter offer" onChange={e => changeAmount(e.target.value)} /></label><label>Percent of balance<input type="number" min="0.01" max="100" step="0.01" value={amount && balance > 0 ? Number((Number(amount) / balance * 100).toFixed(2)) : ""} onChange={e => changeAmount(e.target.value ? (balance * Number(e.target.value) / 100).toFixed(2) : "")} /></label><label>Payment frequency<select value={frequency} onChange={e => { setFrequency(e.target.value); if(e.target.value === "Lump sum") setPayments("1"); setSaved(false); }}><option>Lump sum</option><option>Monthly</option><option>Weekly</option></select></label><label>Number of payments<input type="number" min="1" max="360" step="1" disabled={frequency === "Lump sum"} value={payments} onChange={e => { setPayments(e.target.value); setSaved(false); }} /></label></div>
    <div className="ng-calc-results"><div><span>Client savings</span><strong>{result ? money(result.savings) : "—"}</strong></div><div><span>{Number(payments) > 1 ? "Regular installment" : "Proposed payment"}</span><strong>{result ? money(result.payment) : "—"}</strong></div></div>
    {result && result.finalPayment !== result.payment && <p className="ng-muted">Final installment: {money(result.finalPayment)} (rounding adjustment).</p>}
    {!!amount && !result && <p className="ng-error">Enter an offer within the balance and 1–360 payments of at least $0.01.</p>}
    <label className="ng-calc-notes">Proposed terms<textarea value={notes} maxLength={5000} placeholder="Payment start date, conditions, or other proposed terms…" onChange={e => { setNotes(e.target.value); setSaved(false); }} /></label>
    <div className="ng-calc-actions">{canSave && <button className="ng-button" disabled={!result || busy || saved} onClick={save}>{busy ? "Saving…" : saved ? "Offer saved" : "Save offer"}</button>}{canEmail && <button className="ng-button ng-button-brand" disabled={!result} onClick={draft}>Draft offer email</button>}</div><p className="ng-muted">Calculation only. Review the terms before sending.</p>{notice && <p role="status">{notice}</p>}
  </section>;
}
