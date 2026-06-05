"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  /** Pre-fill the To field */
  defaultTo?: string | null;
  /** Entity context — at least one. Determines which template tokens resolve. */
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  creditorId?: string;
  caseId?: string;
  /** Button label override */
  label?: string;
  /** Button style variant */
  variant?: "primary" | "ghost";
  /** Filter templates to a category (e.g. "Welcome", "Settlement") */
  templateCategory?: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  category: string | null;
}

/**
 * Compose Email button + modal. Drops onto any entity detail page.
 * - Picks a template (or writes from scratch)
 * - Renders the template with the entity's merge tokens
 * - Sends immediately via Resend
 * - The EmailMessage row gets linked to the entity for the Related list
 */
export function ComposeEmailButton({
  defaultTo,
  leadId,
  opportunityId,
  accountId,
  contactId,
  creditorId,
  caseId,
  label = "Email",
  variant = "ghost",
  templateCategory,
}: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [to, setTo] = useState(defaultTo ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/email-templates");
      if (res.ok) {
        const data = (await res.json()) as { templates?: Template[] } | Template[];
        const list = Array.isArray(data) ? data : data.templates ?? [];
        const filtered = templateCategory
          ? list.filter((t) => t.category?.toLowerCase() === templateCategory.toLowerCase())
          : list;
        setTemplates(filtered);
      }
    })();
  }, [open, templateCategory]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject ?? "");
      setBodyHtml(t.bodyHtml ?? t.bodyText ?? "");
    }
  }

  async function send() {
    if (!to) {
      toast.error("Recipient required");
      return;
    }
    if (!subject) {
      toast.error("Subject required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          bodyHtml,
          templateId: templateId || undefined,
          leadId,
          opportunityId,
          accountId,
          contactId,
          creditorId,
          caseId,
          sendNow: true,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        toast.success("Email sent");
        setOpen(false);
        setSubject("");
        setBodyHtml("");
        setTemplateId("");
      } else {
        toast.error(data.error ?? "Send failed", { duration: 7000 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={variant === "primary" ? btnPrimary : btnGhost}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: -1 }}>
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
        {label}
      </button>

      {open && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #ecebea", display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Compose Email</h2>
              <button onClick={() => setOpen(false)} style={iconBtn}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {templates.length > 0 && (
                <>
                  <label style={lbl}>Template (optional)</label>
                  <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} style={input}>
                    <option value="">— Custom message —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.category ? ` (${t.category})` : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label style={lbl}>To</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" style={input} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Cc</label>
                  <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" style={input} />
                </div>
                <div>
                  <label style={lbl}>Bcc</label>
                  <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="optional" style={input} />
                </div>
              </div>

              <label style={lbl}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" style={input} />

              <label style={lbl}>Message</label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={10}
                placeholder="Type your message — supports HTML and {{firstName}} {{businessName}} {{ownerName}} etc."
                style={{ ...input, height: "auto", fontFamily: "inherit", resize: "vertical" }}
              />
              <div style={{ fontSize: 11, color: "#706e6b", marginTop: 4 }}>
                Available tokens: <code>{`{{firstName}}`}</code>, <code>{`{{businessName}}`}</code>, <code>{`{{contactName}}`}</code>, <code>{`{{ownerName}}`}</code>, <code>{`{{escrowBalance}}`}</code>, etc.
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #ecebea", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setOpen(false)} disabled={busy} style={btnSecondary}>Cancel</button>
              <button onClick={send} disabled={busy || !to || !subject} style={btnPrimary}>
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 8, width: 640, maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #d8dde6", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#0070d2", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: 0, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#0070d2", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: "1px solid #0070d2", cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#0070d2", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, border: "1px solid #d8dde6", cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "transparent", border: 0, fontSize: 16, cursor: "pointer", color: "#706e6b" };
