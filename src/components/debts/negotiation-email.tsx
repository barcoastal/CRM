"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type NegotiationEmailMessage = { id: string; subject: string; fromAddress: string; toAddresses: string; direction: string; status: string; createdAt: string };
type Template = { id: string; name: string; subject: string; bodyText: string | null; bodyHtml: string | null };
type Draft = { to: string; subject: string; body: string };

export function NegotiationEmail({ opportunityId, opportunityName, debtId, creditorName, creditorEmail, senderEmail, messages, composeOpen, onComposeChange }: {
  opportunityId: string; opportunityName: string; debtId: string; creditorName: string; creditorEmail: string | null; senderEmail: string; messages: NegotiationEmailMessage[]; composeOpen: boolean; onComposeChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ debtId: string; text: string; error: boolean } | null>(null);
  const draft = drafts[debtId] ?? { to: creditorEmail ?? "", subject: `${opportunityName} — ${creditorName} negotiation`, body: "" };
  function patch(values: Partial<Draft>) { setDrafts((prev) => ({ ...prev, [debtId]: { ...draft, ...values } })); }
  async function loadTemplates() {
    setLoading(true);
    try {
      const response = await fetch("/api/email-templates");
      if (!response.ok) throw new Error("Unable to load Email Center templates.");
      const data = await response.json(); setTemplates(data.items ?? []);
      if (!data.items?.length) setNotice({ debtId, text: "No active email templates are available.", error: false });
    } catch (error) { setNotice({ debtId, text: error instanceof Error ? error.message : "Unable to load templates.", error: true }); }
    finally { setLoading(false); }
  }
  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    const text = template.bodyText ?? new DOMParser().parseFromString((template.bodyHtml ?? "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html").body.textContent ?? "";
    patch({ subject: template.subject, body: text });
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (sending) return;
    if (/{{[^}]+}}/.test(draft.subject + draft.body)) { setNotice({ debtId, text: "Replace the template placeholders before sending.", error: true }); return; }
    setSending(true); setNotice(null);
    try {
      const response = await fetch("/api/emails/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: [draft.to.trim()], subject: draft.subject, bodyText: draft.body, opportunityId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Email could not be sent. Your draft has been kept.");
      setDrafts((prev) => ({ ...prev, [debtId]: { ...draft, body: "" } }));
      setNotice({ debtId, text: "Email sent. It is available in Email Center and this opportunity’s email history.", error: false }); onComposeChange(false); router.refresh();
    } catch (error) { setNotice({ debtId, text: error instanceof Error ? error.message : "Email could not be sent. Your draft has been kept.", error: true }); }
    finally { setSending(false); }
  }
  return <section className="ng-email-panel">
    <div className="ng-panel-heading"><div><h3 className="ng-section-title">Email activity</h3><p>Your messages linked to this opportunity.</p></div><Link href="/email-center" target="_blank" rel="noopener noreferrer" className="ng-text-button">Open Email Center ↗</Link></div>
    {!messages.length ? <div className="ng-empty"><span className="ng-empty-icon" aria-hidden="true">✉</span><h3>No email conversations yet</h3><p>Start a conversation with {creditorName}. Sent emails will appear here.</p><button className="ng-button" onClick={() => onComposeChange(true)}>New email</button></div> : <ul className="ng-email-list">{messages.map((message) => <li key={message.id}><span className="ng-mail-icon" aria-hidden="true">✉</span><div><strong>{message.subject || "(No subject)"}</strong><p>{message.direction === "INBOUND" ? `From: ${message.fromAddress}` : `To: ${message.toAddresses}`}</p></div><span className="ng-mail-meta">{message.status}<br />{new Date(message.createdAt).toLocaleDateString()}</span></li>)}</ul>}
    {!composeOpen && notice?.debtId === debtId && <p role={notice.error ? "alert" : "status"} className={notice.error ? "ng-error" : "ng-success"}>{notice.text}</p>}
    <Dialog open={composeOpen} onOpenChange={(open) => { if (!sending) onComposeChange(open); }}>
      <DialogContent className="ng-compose" showCloseButton={!sending}>
        <div className="ng-compose-heading"><DialogTitle>New email</DialogTitle><DialogDescription>{creditorName} · {opportunityName}</DialogDescription></div>
        <form onSubmit={send}>
          <fieldset disabled={sending}>
            <div className="ng-compose-row"><span>From</span><strong>{senderEmail}</strong></div>
            <label className="ng-compose-row"><span>To</span><input type="email" required value={draft.to} onChange={(event) => patch({ to: event.target.value })} placeholder="Creditor email address" /></label>
            <label className="ng-compose-row"><span>Subject</span><input required value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} /></label>
            <div className="ng-compose-templates"><button className="ng-text-button" type="button" disabled={loading} onClick={loadTemplates}>{loading ? "Loading templates…" : "Insert template"}</button>{templates.length > 0 && <select aria-label="Email template" defaultValue="" onChange={(event) => applyTemplate(event.target.value)}><option value="" disabled>Choose a template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
            <textarea aria-label="Message" required value={draft.body} onChange={(event) => patch({ body: event.target.value })} placeholder="Write your message…" className="ng-message-body" />
            {notice?.debtId === debtId && <p role={notice.error ? "alert" : "status"} className={notice.error ? "ng-error" : "ng-success"}>{notice.text}</p>}
            <div className="ng-compose-footer"><span>Sent through your Email Center account</span><div><button type="button" className="ng-button" onClick={() => onComposeChange(false)}>Close</button><Button type="submit">{sending ? "Sending…" : "Send email"}</Button></div></div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
