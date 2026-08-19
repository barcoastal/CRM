"use client";

/**
 * Email Center Templates hub. One place to manage outbound content: an
 * Email / SMS channel toggle, a list per channel, and an inline editor.
 * Email reuses /api/email-templates (so campaign/flow pickers keep working);
 * SMS uses /api/email-center/sms-templates. Both support {{token}} merge fields.
 */
import { useState } from "react";

type Channel = "email" | "sms";

interface EmailTpl { id: string; name: string; subject: string; body: string }
interface SmsTpl { id: string; name: string; body: string; isActive: boolean }

/** Turn a name into a valid EmailTemplate.developerName (A-Z0-9_, starts with a letter). */
function devName(name: string): string {
  const slug = name.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const safe = /^[A-Za-z]/.test(slug) ? slug : `T_${slug}`;
  return (safe || "Template") + "_" + Math.random().toString(36).slice(2, 6);
}

function smsCount(body: string): { chars: number; segments: number } {
  const chars = body.length;
  return { chars, segments: chars === 0 ? 0 : Math.ceil(chars / 160) };
}

export function TemplatesClient({
  emailTemplates, smsTemplates,
}: {
  emailTemplates: EmailTpl[];
  smsTemplates: SmsTpl[];
}) {
  const [channel, setChannel] = useState<Channel>("email");
  const [emails, setEmails] = useState(emailTemplates);
  const [smses, setSmses] = useState(smsTemplates);

  // Editor state. `editing` holds the record being edited (id === "" for new).
  const [editingEmail, setEditingEmail] = useState<EmailTpl | null>(null);
  const [editingSms, setEditingSms] = useState<SmsTpl | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setError(null);
    if (channel === "email") setEditingEmail({ id: "", name: "", subject: "", body: "" });
    else setEditingSms({ id: "", name: "", body: "", isActive: true });
  }

  async function saveEmail() {
    if (!editingEmail || !editingEmail.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    const isNew = editingEmail.id === "";
    const payload = isNew
      ? { name: editingEmail.name.trim(), developerName: devName(editingEmail.name), subject: editingEmail.subject || "(no subject)", bodyHtml: editingEmail.body, bodyText: editingEmail.body }
      : { name: editingEmail.name.trim(), subject: editingEmail.subject, bodyHtml: editingEmail.body, bodyText: editingEmail.body };
    const res = await fetch(isNew ? "/api/email-templates" : `/api/email-templates/${editingEmail.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    const row: EmailTpl = { id: data.id, name: data.name, subject: data.subject, body: data.bodyHtml ?? data.bodyText ?? "" };
    setEmails((prev) => (isNew ? [...prev, row].sort((a, b) => a.name.localeCompare(b.name)) : prev.map((t) => (t.id === row.id ? row : t))));
    setEditingEmail(null);
  }

  async function saveSms() {
    if (!editingSms || !editingSms.name.trim()) { setError("Name is required"); return; }
    if (!editingSms.body.trim()) { setError("Message is required"); return; }
    setSaving(true); setError(null);
    const isNew = editingSms.id === "";
    const res = await fetch(isNew ? "/api/email-center/sms-templates" : `/api/email-center/sms-templates/${editingSms.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingSms.name.trim(), body: editingSms.body }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    const row: SmsTpl = { id: data.id, name: data.name, body: data.body, isActive: data.isActive };
    setSmses((prev) => (isNew ? [row, ...prev] : prev.map((t) => (t.id === row.id ? row : t))));
    setEditingSms(null);
  }

  async function removeSms(id: string) {
    const res = await fetch(`/api/email-center/sms-templates/${id}`, { method: "DELETE" });
    if (res.ok) setSmses((prev) => prev.filter((t) => t.id !== id));
  }

  const list = channel === "email" ? emails : smses;

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Templates</h1>
          <p className="ec-flows-sub">Reusable content for everything you send. Use {"{{firstName}}"} style merge fields.</p>
        </div>
        <button className="ec-btn ec-btn-primary" onClick={openNew}>New Template</button>
      </div>

      <div className="ec-source-grid" style={{ marginBottom: 16 }}>
        <button className={`ec-source-chip${channel === "email" ? " ec-source-chip-on" : ""}`} onClick={() => { setChannel("email"); setEditingSms(null); }}>
          Email <span className="ec-source-chip-sub">{emails.length}</span>
        </button>
        <button className={`ec-source-chip${channel === "sms" ? " ec-source-chip-on" : ""}`} onClick={() => { setChannel("sms"); setEditingEmail(null); }}>
          SMS <span className="ec-source-chip-sub">{smses.length}</span>
        </button>
      </div>

      {channel === "sms" ? (
        <div className="ec-pill ec-pill-amber" style={{ marginBottom: 14 }}>
          SMS sending arrives with Phase 2. You can write and save SMS templates now.
        </div>
      ) : null}

      {/* Email editor */}
      {editingEmail ? (
        <div className="ec-seg-editor" style={{ maxWidth: 720 }}>
          <div><label className="ec-field-label">Template name</label>
            <input className="ec-input" placeholder="Welcome email" value={editingEmail.name} onChange={(e) => setEditingEmail({ ...editingEmail, name: e.target.value })} /></div>
          <div style={{ marginTop: 12 }}><label className="ec-field-label">Subject</label>
            <input className="ec-input" placeholder="Welcome, {{firstName}}" value={editingEmail.subject} onChange={(e) => setEditingEmail({ ...editingEmail, subject: e.target.value })} /></div>
          <div style={{ marginTop: 12 }}><label className="ec-field-label">Body (HTML or plain text)</label>
            <textarea className="ec-textarea" rows={12} value={editingEmail.body} onChange={(e) => setEditingEmail({ ...editingEmail, body: e.target.value })} /></div>
          {error ? <div className="ec-error" style={{ marginTop: 10 }}>{error}</div> : null}
          <div className="ec-seg-editor-foot">
            <span style={{ flex: 1 }} />
            <button className="ec-btn ec-btn-ghost" onClick={() => setEditingEmail(null)}>Cancel</button>
            <button className="ec-btn ec-btn-primary" disabled={saving || !editingEmail.name.trim()} onClick={() => void saveEmail()}>{saving ? "Saving..." : "Save Template"}</button>
          </div>
        </div>
      ) : null}

      {/* SMS editor */}
      {editingSms ? (
        <div className="ec-seg-editor" style={{ maxWidth: 620 }}>
          <div><label className="ec-field-label">Template name</label>
            <input className="ec-input" placeholder="Payment reminder" value={editingSms.name} onChange={(e) => setEditingSms({ ...editingSms, name: e.target.value })} /></div>
          <div style={{ marginTop: 12 }}><label className="ec-field-label">Message</label>
            <textarea className="ec-textarea" rows={5} placeholder="Hi {{firstName}}, your call is booked." value={editingSms.body} onChange={(e) => setEditingSms({ ...editingSms, body: e.target.value })} />
            <div style={{ fontSize: 11.5, color: "var(--ec-faint)", marginTop: 4 }}>
              {(() => { const c = smsCount(editingSms.body); return `${c.chars} characters · ${c.segments} segment${c.segments === 1 ? "" : "s"}`; })()}
            </div></div>
          {error ? <div className="ec-error" style={{ marginTop: 10 }}>{error}</div> : null}
          <div className="ec-seg-editor-foot">
            <span style={{ flex: 1 }} />
            <button className="ec-btn ec-btn-ghost" onClick={() => setEditingSms(null)}>Cancel</button>
            <button className="ec-btn ec-btn-primary" disabled={saving || !editingSms.name.trim() || !editingSms.body.trim()} onClick={() => void saveSms()}>{saving ? "Saving..." : "Save Template"}</button>
          </div>
        </div>
      ) : null}

      {/* List */}
      {list.length === 0 && !editingEmail && !editingSms ? (
        <div className="ec-empty" style={{ paddingTop: 50 }}>
          <div className="ec-empty-title">No {channel === "email" ? "email" : "SMS"} templates yet</div>
          <div className="ec-empty-sub">Create one to reuse across campaigns and flows.</div>
        </div>
      ) : (
        <div className="ec-flows-list" style={{ maxWidth: 920, marginTop: editingEmail || editingSms ? 18 : 0 }}>
          {channel === "email" ? emails.map((t) => (
            <div key={t.id} className="ec-flow-row">
              <button className="ec-flow-main" style={{ background: "none", border: 0, textAlign: "left", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                onClick={() => { setError(null); setEditingEmail(t); }}>
                <span className="ec-flow-name">{t.name}</span>
                <span className="ec-flow-desc">{t.subject}</span>
              </button>
              <span className="ec-pill ec-pill-neutral">Email</span>
            </div>
          )) : smses.map((t) => (
            <div key={t.id} className="ec-flow-row">
              <button className="ec-flow-main" style={{ background: "none", border: 0, textAlign: "left", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                onClick={() => { setError(null); setEditingSms(t); }}>
                <span className="ec-flow-name">{t.name}</span>
                <span className="ec-flow-desc">{t.body.slice(0, 80)}</span>
              </button>
              <span className="ec-pill ec-pill-neutral">SMS</span>
              <button className="ec-btn ec-btn-ghost" onClick={() => void removeSms(t.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
