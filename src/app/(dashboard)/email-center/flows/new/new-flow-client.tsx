"use client";

/**
 * New flow setup: name + entity + trigger + re-entry. POSTs to /api/flows and
 * drops into the vertical builder. Klaviyo-styled.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ENTITIES = ["Lead", "Contact", "Opportunity", "Account", "Case"];
const TRIGGERS = [
  { value: "INSERT", label: "created" },
  { value: "UPDATE", label: "updated" },
  { value: "INSERT_OR_UPDATE", label: "created or updated" },
  { value: "INACTIVITY", label: "inactive for N days" },
];
const REENTRY = [
  { value: "ALWAYS", label: "Every trigger" },
  { value: "ONCE", label: "Once per record" },
  { value: "COOLDOWN", label: "Cooldown" },
];

export function NewFlowClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("Lead");
  const [triggerEvent, setTriggerEvent] = useState("INSERT");
  const [inactivityDays, setInactivityDays] = useState(14);
  const [reentryPolicy, setReentryPolicy] = useState("ALWAYS");
  const [reentryCooldownDays, setReentryCooldownDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), entityType, triggerEvent, isActive: false,
        reentryPolicy, reentryCooldownDays,
        inactivityDays: triggerEvent === "INACTIVITY" ? inactivityDays : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || !data.flow?.id) { setError(data.error ?? "Could not create flow"); return; }
    router.push(`/email-center/flows/${data.flow.id}`);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">New Flow</h1>
          <p className="ec-flows-sub">Name it and choose what starts it. You will build the steps next.</p>
        </div>
      </div>
      <div className="ec-seg-editor" style={{ maxWidth: 620 }}>
        <div>
          <label className="ec-field-label">Flow name</label>
          <input className="ec-input" placeholder="Welcome new leads" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">When a</label>
            <select className="ec-select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">is</label>
            <select className="ec-select" value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {triggerEvent === "INACTIVITY" ? (
            <div style={{ width: 120 }}>
              <label className="ec-field-label">Days</label>
              <input className="ec-input" type="number" min={1} value={inactivityDays} onChange={(e) => setInactivityDays(Number(e.target.value))} />
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">Re-entry</label>
            <select className="ec-select" value={reentryPolicy} onChange={(e) => setReentryPolicy(e.target.value)}>
              {REENTRY.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {reentryPolicy === "COOLDOWN" ? (
            <div style={{ width: 140 }}>
              <label className="ec-field-label">Cooldown days</label>
              <input className="ec-input" type="number" min={1} value={reentryCooldownDays} onChange={(e) => setReentryCooldownDays(Number(e.target.value))} />
            </div>
          ) : null}
        </div>
        {error ? <div className="ec-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="ec-seg-editor-foot">
          <span style={{ flex: 1 }} />
          <Link className="ec-btn ec-btn-ghost" href="/email-center/flows">Cancel</Link>
          <button className="ec-btn ec-btn-primary" disabled={saving || !name.trim()} onClick={() => void create()}>
            {saving ? "Creating..." : "Create & build"}
          </button>
        </div>
      </div>
    </div>
  );
}
