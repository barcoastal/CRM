"use client";

/**
 * Email Center Flows tab: Klaviyo-style list over the existing Flow builder.
 * Rows link into the full canvas editor at /automation/flows/[id]; the toggle
 * PATCHes isActive through the existing /api/flows/[id] route.
 */
import { useState } from "react";
import Link from "next/link";

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  triggerEvent: string;
  inactivityDays: number | null;
  reentryPolicy: string;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
}

function triggerLabel(f: FlowRow): string {
  switch (f.triggerEvent) {
    case "INSERT": return `${f.entityType} created`;
    case "UPDATE": return `${f.entityType} updated`;
    case "INSERT_OR_UPDATE": return `${f.entityType} created or updated`;
    case "INACTIVITY": return `${f.entityType} inactive ${f.inactivityDays ?? "?"}d`;
    default: return f.triggerEvent;
  }
}

export function FlowsClient({ flows: initial }: { flows: FlowRow[] }) {
  const [flows, setFlows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(f: FlowRow) {
    setBusy(f.id);
    const res = await fetch(`/api/flows/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    if (res.ok) {
      setFlows((prev) => prev.map((x) => (x.id === f.id ? { ...x, isActive: !f.isActive } : x)));
    }
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Flows</h1>
          <p className="ec-flows-sub">
            Automations that send email, create tasks, and update records. Built in the flow canvas.
          </p>
        </div>
        <Link className="ec-btn ec-btn-primary" href="/automation/flows/new">
          New Flow
        </Link>
      </div>
      {flows.length === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No flows yet</div>
          <div className="ec-empty-sub">Create your first automation in the flow canvas.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {flows.map((f) => (
            <div key={f.id} className="ec-flow-row">
              <button
                className={`ec-switch${f.isActive ? " ec-switch-on" : ""}`}
                title={f.isActive ? "Deactivate" : "Activate"}
                disabled={busy === f.id}
                onClick={() => void toggle(f)}
              >
                <span className="ec-switch-knob" />
              </button>
              <Link href={`/automation/flows/${f.id}`} className="ec-flow-main">
                <span className="ec-flow-name">{f.name}</span>
                {f.description ? <span className="ec-flow-desc">{f.description}</span> : null}
              </Link>
              <span className="ec-pill ec-pill-neutral">{triggerLabel(f)}</span>
              {f.reentryPolicy !== "ALWAYS" ? (
                <span className="ec-pill ec-pill-neutral">{f.reentryPolicy.toLowerCase()}</span>
              ) : null}
              <span className="ec-flow-stat">
                {f.runCount} run{f.runCount === 1 ? "" : "s"}
                {f.lastRunAt
                  ? ` · last ${new Date(f.lastRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : ""}
              </span>
              <span className={`ec-pill ${f.isActive ? "ec-pill-live" : "ec-pill-neutral"}`}>
                {f.isActive ? "Live" : "Draft"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
