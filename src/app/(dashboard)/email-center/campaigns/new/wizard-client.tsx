"use client";

/**
 * New campaign wizard: name + from + template + multi-source audience with a
 * live combined count + send now / schedule / throttle. Creates the MassEmail
 * draft then either sends or schedules through /api/emails/mass/[id]/send.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Option { id: string; name: string; entity?: string }
interface Source { type: "segment" | "listview" | "campaign"; id: string }

export function WizardClient({
  me, templates, segments, listViews, dialerCampaigns, users,
}: {
  me: { id: string; name: string };
  templates: Option[];
  segments: Option[];
  listViews: Option[];
  dialerCampaigns: Option[];
  users: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [fromUserId, setFromUserId] = useState(me.id);
  const [sources, setSources] = useState<Source[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [throttle, setThrottle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback((next: Source[]) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    if (next.length === 0) { setCount(null); return; }
    countTimer.current = setTimeout(async () => {
      const res = await fetch("/api/emails/mass/audience-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceType: "sources", audienceSources: next }),
      });
      const data = await res.json().catch(() => ({}));
      setCount(typeof data.count === "number" ? data.count : null);
    }, 350);
  }, []);

  function toggleSource(type: Source["type"], id: string) {
    setSources((prev) => {
      const exists = prev.some((s) => s.type === type && s.id === id);
      const next = exists ? prev.filter((s) => !(s.type === type && s.id === id)) : [...prev, { type, id }];
      refreshCount(next);
      return next;
    });
  }

  const picked = (type: Source["type"], id: string) => sources.some((s) => s.type === type && s.id === id);

  async function launch() {
    setBusy(true);
    setError(null);
    const createRes = await fetch("/api/emails/mass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateId: templateId || undefined,
        fromUserId,
        audienceType: "sources",
        audienceSources: sources,
        throttlePerMinute: throttle ? Number(throttle) : undefined,
      }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created.id) {
      setBusy(false);
      setError((created as { error?: string }).error ?? "Could not create campaign");
      return;
    }
    const sendRes = await fetch(`/api/emails/mass/${(created as { id: string }).id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(when === "later" && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    });
    const sent = await sendRes.json().catch(() => ({}));
    setBusy(false);
    if (!sendRes.ok) {
      setError((sent as { error?: string }).error ?? "Send failed");
      return;
    }
    router.push("/email-center/campaigns");
  }

  useEffect(() => () => { if (countTimer.current) clearTimeout(countTimer.current); }, []);

  const canLaunch = name.trim() && templateId && sources.length > 0 && (when === "now" || scheduledAt);

  function sourceGroup(title: string, type: Source["type"], options: Option[]) {
    if (options.length === 0) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div className="ec-field-label">{title}</div>
        <div className="ec-source-grid">
          {options.map((o) => (
            <button
              key={o.id}
              className={`ec-source-chip${picked(type, o.id) ? " ec-source-chip-on" : ""}`}
              onClick={() => toggleSource(type, o.id)}
            >
              {o.name}
              {o.entity ? <span className="ec-source-chip-sub">{o.entity}</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">New Campaign</h1>
          <p className="ec-flows-sub">Pick who gets it, what they get, and when.</p>
        </div>
      </div>
      <div className="ec-seg-editor" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">Campaign name</label>
            <input className="ec-input" value={name} placeholder="August payoff promo"
              onChange={(e) => setName(e.target.value)} />
          </div>
          {users.length > 0 ? (
            <div style={{ width: 220 }}>
              <label className="ec-field-label">Send as</label>
              <select className="ec-select" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="ec-field-label">Template</label>
          <select className="ec-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Pick a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="ec-field-label">Audience (union of everything selected, deduped by email)</label>
          {sourceGroup("Segments", "segment", segments)}
          {sourceGroup("List Views", "listview", listViews)}
          {sourceGroup("Dialer Campaigns", "campaign", dialerCampaigns)}
          <span className="ec-pill ec-pill-green">
            {sources.length === 0 ? "Nothing selected" : count === null ? "Counting..." : `~${count.toLocaleString()} recipients before dedupe/suppression`}
          </span>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label className="ec-field-label">When</label>
            <select className="ec-select" value={when} onChange={(e) => setWhen(e.target.value as "now" | "later")}>
              <option value="now">Send now</option>
              <option value="later">Schedule</option>
            </select>
          </div>
          {when === "later" ? (
            <div>
              <label className="ec-field-label">Send at</label>
              <input className="ec-input" type="datetime-local" value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          ) : null}
          <div style={{ width: 190 }}>
            <label className="ec-field-label">Throttle (emails/min, optional)</label>
            <input className="ec-input" type="number" min={1} max={600} value={throttle} placeholder="Full speed"
              onChange={(e) => setThrottle(e.target.value)} />
          </div>
        </div>
        {error ? <div className="ec-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="ec-seg-editor-foot">
          <span style={{ flex: 1 }} />
          <button className="ec-btn ec-btn-ghost" onClick={() => router.push("/email-center/campaigns")}>Cancel</button>
          <button className="ec-btn ec-btn-primary" disabled={busy || !canLaunch} onClick={() => void launch()}>
            {busy ? "Working..." : when === "later" ? "Schedule Campaign" : "Send Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
