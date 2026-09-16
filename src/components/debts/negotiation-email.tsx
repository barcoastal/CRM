"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type NegotiationEmailMessage = { id: string; subject: string; fromAddress: string; toAddresses: string; direction: string; status: string; createdAt: string };
type Template = { id: string; name: string; subject: string; bodyText: string | null; bodyHtml: string | null };
type Draft = { to: string; subject: string; body: string };

export function NegotiationEmail({ opportunityId, opportunityName, debtId, creditorName, creditorEmail, senderEmail, messages }: {
  opportunityId: string; opportunityName: string; debtId: string; creditorName: string; creditorEmail: string | null; senderEmail: string; messages: NegotiationEmailMessage[];
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
      setNotice({ debtId, text: "Email sent. It is available in Email Center and this opportunity’s email history.", error: false }); router.refresh();
    } catch (error) { setNotice({ debtId, text: error instanceof Error ? error.message : "Email could not be sent. Your draft has been kept.", error: true }); }
    finally { setSending(false); }
  }
  return <section className="space-y-4 rounded border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Email creditor</h3><Link href="/email-center" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0176d3]">Open Email Center</Link></div>
    <p className="text-xs text-muted-foreground">From: {senderEmail} · Uses your Email Center Gmail connection</p>
    <form onSubmit={send} className="space-y-3">
      <fieldset disabled={sending} className="space-y-3">
        <label className="block text-sm">To<input type="email" required value={draft.to} onChange={(event) => patch({ to: event.target.value })} placeholder="Creditor email address" className="mt-1 block w-full rounded border p-2" /></label>
        {!creditorEmail && <p className="text-xs text-muted-foreground">No creditor email is saved for this debt. Enter the recipient above.</p>}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={loading} onClick={loadTemplates}>{loading ? "Loading…" : "Load Email Center templates"}</Button>{templates.length > 0 && <select aria-label="Email template" defaultValue="" onChange={(event) => applyTemplate(event.target.value)} className="rounded border bg-white px-2 text-sm"><option value="" disabled>Choose a template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
        <label className="block text-sm">Subject<input required value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block text-sm">Message<textarea required rows={6} value={draft.body} onChange={(event) => patch({ body: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
        <Button type="submit">{sending ? "Sending…" : "Send email"}</Button>
      </fieldset>
      {notice?.debtId === debtId && <p role={notice.error ? "alert" : "status"} className={`text-sm ${notice.error ? "text-red-600" : "text-green-700"}`}>{notice.text}</p>}
    </form>
    <div className="border-t pt-3"><h4 className="text-sm font-semibold">Your opportunity emails</h4><p className="mt-1 text-xs text-muted-foreground">Latest 50 messages linked to this opportunity across its creditors.</p>
      {!messages.length ? <p className="mt-3 text-sm text-muted-foreground">No emails linked to this opportunity in your mailbox yet.</p> : <ul className="mt-3 divide-y">{messages.map((message) => <li key={message.id} className="py-3 text-sm"><div className="font-medium">{message.subject || "(No subject)"}</div><div className="text-xs text-muted-foreground">{message.direction === "INBOUND" ? `From: ${message.fromAddress}` : `To: ${message.toAddresses}`} · {message.status} · {new Date(message.createdAt).toLocaleDateString()}</div></li>)}</ul>}
    </div>
  </section>;
}
