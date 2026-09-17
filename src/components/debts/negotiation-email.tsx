"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type NegotiationEmailMessage = { id: string; subject: string; fromAddress: string; toAddresses: string; direction: string; status: string; createdAt: string; bodyText?: string | null; bodyHtml?: string | null; attachments?: { id: string; filename: string }[] };
type Template = { id: string; name: string; subject: string; bodyText: string | null; bodyHtml: string | null };
type Attachment = { storagePath: string; filename: string; contentType: string; byteSize: number };
type Draft = { to: string; subject: string; body: string; replyToMessageId?: string; attachments?: Attachment[] };

export function NegotiationEmail({ opportunityId, opportunityName, debtId, creditorName, creditorEmail, senderEmail, messages, composeOpen, onComposeChange, offerDraft, documents = [] }: {
  documents?: { id: string; name: string }[]; offerDraft?: { body: string; token: number } | null; opportunityId: string; opportunityName: string; debtId: string; creditorName: string; creditorEmail: string | null; senderEmail: string; messages: NegotiationEmailMessage[]; composeOpen: boolean; onComposeChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [mailFilter, setMailFilter] = useState("all");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ debtId: string; text: string; error: boolean } | null>(null);
  const draft = drafts[debtId] ?? { to: creditorEmail ?? "", subject: `${opportunityName} — ${creditorName} negotiation`, body: "" };
  function patch(values: Partial<Draft>) { setDrafts((prev) => ({ ...prev, [debtId]: { ...draft, ...values } })); }
  const appliedOffer = useRef<number | null>(null);
  useEffect(() => {
    if (!offerDraft || appliedOffer.current === offerDraft.token) return;
    appliedOffer.current = offerDraft.token;
    if (offerDraft) setDrafts(prev => ({ ...prev, [debtId]: { to: creditorEmail ?? "", subject: `${opportunityName} — ${creditorName} settlement proposal`, body: offerDraft.body } }));
  }, [offerDraft, debtId, creditorEmail, creditorName, opportunityName]);
  const visibleMessages = messages.filter(message => mailFilter !== "creditor" || (creditorEmail && `${message.fromAddress},${message.toAddresses}`.toLowerCase().includes(creditorEmail.toLowerCase())));
  const selectedMessage = messages.find(message => message.id === selectedMessageId);
  function reply(message: NegotiationEmailMessage) {
    const address = message.direction === "INBOUND" ? message.fromAddress : message.toAddresses.split(",")[0];
    const to = address.match(/<([^>]+)>/)?.[1] ?? address.trim();
    patch({ to, subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, body: "", replyToMessageId: message.id });
    onComposeChange(true);
  }
  async function attach(file?: File, documentId?: string) {
    if (uploading) return;
    setUploading(true); setNotice(null);
    try {
      if (documentId) {
        const doc = documents.find(item => item.id === documentId);
        if (!doc) throw new Error("Document not found.");
        const response = await fetch(`/api/opportunities/${opportunityId}/negotiation-documents/${doc.id}`);
        if (!response.ok) throw new Error("This document is unavailable. The draft has been kept.");
        file = new File([await response.blob()], doc.name, { type: "application/octet-stream" });
      }
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) throw new Error("Choose a file smaller than 20 MB.");
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/emails/attachments", { method: "POST", body: form });
      const attachment = await response.json();
      if (!response.ok) throw new Error(attachment.error || "Unable to attach file.");
      setDrafts(prev => ({ ...prev, [debtId]: { ...(prev[debtId] ?? draft), attachments: [...(prev[debtId]?.attachments ?? []), attachment] } }));
    } catch(error) { setNotice({ debtId, error: true, text: error instanceof Error ? error.message : "Unable to attach file." }); }
    finally { setUploading(false); }
  }
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
    event.preventDefault(); if (sending || uploading) return;
    if (/{{[^}]+}}/.test(draft.subject + draft.body)) { setNotice({ debtId, text: "Replace the template placeholders before sending.", error: true }); return; }
    setSending(true); setNotice(null);
    try {
      const response = await fetch("/api/emails/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: [draft.to.trim()], subject: draft.subject, bodyText: draft.body, attachments: draft.attachments ?? [], replyToMessageId: draft.replyToMessageId, opportunityId, negotiation: true }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Email could not be sent. Your draft has been kept.");
      setDrafts((prev) => ({ ...prev, [debtId]: { ...draft, body: "", attachments: [], replyToMessageId: undefined } }));
      setNotice({ debtId, text: "Email sent. It is available in Email Center and this opportunity’s email history.", error: false }); onComposeChange(false); router.refresh();
    } catch (error) { setNotice({ debtId, text: error instanceof Error ? error.message : "Email could not be sent. Your draft has been kept.", error: true }); }
    finally { setSending(false); }
  }
  return <section className="ng-email-panel">
    <div className="ng-panel-heading"><div><h3 className="ng-section-title">Email activity</h3><p>Your messages linked to this opportunity.</p></div><Link href="/email-center" target="_blank" rel="noopener noreferrer" className="ng-text-button">Open Email Center ↗</Link></div>
    <div className="ng-mail-toolbar"><div><button className={`ng-button ${mailFilter === "all" ? "is-selected" : ""}`} onClick={() => setMailFilter("all")}>Opportunity emails ({messages.length})</button><button className={`ng-button ${mailFilter === "creditor" ? "is-selected" : ""}`} disabled={!creditorEmail} onClick={() => setMailFilter("creditor")}>This creditor</button></div><button className="ng-button ng-button-brand" onClick={() => { patch({ replyToMessageId: undefined }); onComposeChange(true); }}>New email</button></div>
    {!visibleMessages.length ? <div className="ng-empty"><span className="ng-empty-icon" aria-hidden="true">✉</span><h3>No linked conversations{mailFilter === "creditor" ? " for this creditor" : " yet"}</h3><p>Messages linked to this opportunity in your Email Center mailbox appear here.</p></div> : <div className="ng-mail-workspace"><ul className="ng-email-list">{visibleMessages.map(message => <li key={message.id} className={selectedMessageId === message.id ? "is-active" : ""}><button className="ng-message-select" onClick={() => setSelectedMessageId(message.id)}><strong>{message.subject || "(No subject)"}</strong><p>{message.direction === "INBOUND" ? message.fromAddress : `To: ${message.toAddresses}`}</p><small>{new Date(message.createdAt).toLocaleDateString()} · {message.status}</small></button></li>)}</ul><section className="ng-message-reader">{selectedMessage ? <><header><h3>{selectedMessage.subject || "(No subject)"}</h3><p><strong>From:</strong> {selectedMessage.fromAddress}</p><p><strong>To:</strong> {selectedMessage.toAddresses}</p><p className="ng-muted">{new Date(selectedMessage.createdAt).toLocaleString()}</p><button className="ng-button" onClick={() => reply(selectedMessage)}>Reply</button></header>{selectedMessage.bodyText ? <div className="ng-email-body">{selectedMessage.bodyText}</div> : selectedMessage.bodyHtml ? <iframe title="Email message" sandbox="" referrerPolicy="no-referrer" className="ng-email-html" srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:14px Arial,sans-serif;line-height:1.6;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>${selectedMessage.bodyHtml}</body></html>`} /> : <p className="ng-muted">This message has no stored body.</p>}{!!selectedMessage.attachments?.length && <div className="ng-mail-attachments"><strong>Attachments</strong>{selectedMessage.attachments.map(file => <a key={file.id} href={`/api/emails/${selectedMessage.id}/attachments/${file.id}`}>▤ {file.filename}</a>)}</div>}</> : <div className="ng-empty"><h3>Select an email</h3><p>Read the message, download attachments, and reply here.</p></div>}</section></div>}
    {!composeOpen && notice?.debtId === debtId && <p role={notice.error ? "alert" : "status"} className={notice.error ? "ng-error" : "ng-success"}>{notice.text}</p>}
    <Dialog open={composeOpen} onOpenChange={(open) => { if (!sending && !uploading) onComposeChange(open); }}>
      <DialogContent className="ng-compose" showCloseButton={!sending && !uploading}>
        <div className="ng-compose-heading"><DialogTitle>{draft.replyToMessageId ? "Reply to email" : "New email"}</DialogTitle><DialogDescription>{creditorName} · {opportunityName}</DialogDescription></div>
        <form onSubmit={send}>
          <fieldset disabled={sending || uploading}>
            <div className="ng-compose-row"><span>From</span><strong>{senderEmail}</strong></div>
            <label className="ng-compose-row"><span>To</span><input type="email" required value={draft.to} onChange={(event) => patch({ to: event.target.value })} placeholder="Creditor email address" /></label>
            <label className="ng-compose-row"><span>Subject</span><input required value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} /></label>
            <div className="ng-compose-templates"><button className="ng-text-button" type="button" disabled={loading} onClick={loadTemplates}>{loading ? "Loading templates…" : "Insert template"}</button>{templates.length > 0 && <select aria-label="Email template" defaultValue="" onChange={(event) => applyTemplate(event.target.value)}><option value="" disabled>Choose a template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
            <div className="ng-compose-files"><label className="ng-text-button">{uploading ? "Attaching…" : "Attach file"}<input type="file" aria-label="Attach file" onChange={event => { const file = event.target.files?.[0]; if(file) void attach(file); event.target.value = ""; }} /></label>{documents.length > 0 && <select aria-label="Attach related document" value="" onChange={event => { if(event.target.value) void attach(undefined, event.target.value); }}><option value="">Attach related document…</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select>}{draft.attachments?.map((file,index) => <span key={file.storagePath}>{file.filename}<button type="button" aria-label={`Remove ${file.filename}`} onClick={() => patch({ attachments: draft.attachments?.filter((_,i) => i !== index) })}>×</button></span>)}</div>
            <textarea aria-label="Message" required value={draft.body} onChange={(event) => patch({ body: event.target.value })} placeholder="Write your message…" className="ng-message-body" />
            {notice?.debtId === debtId && <p role={notice.error ? "alert" : "status"} className={notice.error ? "ng-error" : "ng-success"}>{notice.text}</p>}
            <div className="ng-compose-footer"><span>Sent through your Email Center account</span><div><button type="button" className="ng-button" onClick={() => onComposeChange(false)}>Close</button><Button type="submit">{sending ? "Sending…" : "Send email"}</Button></div></div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
