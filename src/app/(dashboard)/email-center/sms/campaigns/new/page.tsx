"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Seg { id: string; name: string; entity: string }
interface Tpl { id: string; name: string; body: string }

export default function NewSmsCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<"Lead" | "Contact">("Lead");
  const [segmentId, setSegmentId] = useState("");
  const [body, setBody] = useState("");
  const [segments, setSegments] = useState<Seg[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-center/segments").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => setSegments(d.items ?? [])).catch(() => {});
    fetch("/api/email-center/sms-templates").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => setTemplates(d.items ?? [])).catch(() => {});
  }, []);

  async function create() {
    setErr(null);
    if (!name.trim()) return setErr("Name your campaign.");
    if (!body.trim()) return setErr("Write the message.");
    setBusy(true);
    try {
      const res = await fetch("/api/email-center/sms-campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body, entity, segmentId: segmentId || null }),
      });
      if (res.ok) { const c = await res.json(); router.push(`/email-center/sms/campaigns/${c.id}`); }
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not create.");
    } finally { setBusy(false); }
  }

  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#0d121c", marginBottom: 5 };
  const input: React.CSSProperties = { width: "100%", border: "1px solid #cfd6e4", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", color: "#0d121c" };
  const segOptions = segments.filter((s) => s.entity === entity);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", color: "#0d121c" }}>New SMS Campaign</h1>
      <div style={{ maxWidth: 560, background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, padding: 20 }}>
        <div style={{ marginBottom: 16 }}><label style={label}>Campaign name</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Audience</label>
            <select style={input} value={entity} onChange={(e) => { setEntity(e.target.value as "Lead" | "Contact"); setSegmentId(""); }}>
              <option value="Lead">Leads</option>
              <option value="Contact">Contacts</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Segment</label>
            <select style={input} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">All {entity === "Lead" ? "leads" : "contacts"} with a phone</option>
              {segOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={label}>Insert from template</label>
          <select style={input} value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setBody(t.body); }}>
            <option value="">Choose a template...</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Message</label>
          <textarea style={{ ...input, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{firstName}}, ..." />
          <div style={{ fontSize: 11, color: "#8a94a6", marginTop: 4 }}>{body.length} chars · ~{Math.max(1, Math.ceil(body.length / 160))} segment(s) each. {"{{firstName}}"} merge supported. Include an opt-out (e.g. "Reply STOP").</div>
        </div>
        {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button onClick={create} disabled={busy} style={{ background: "#3052ff", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Creating..." : "Create draft"}
        </button>
        <p style={{ fontSize: 12, color: "#8a94a6", marginTop: 10 }}>You&apos;ll review the audience size and send on the next screen.</p>
      </div>
    </div>
  );
}
