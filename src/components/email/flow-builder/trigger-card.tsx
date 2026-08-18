"use client";

const TRIGGER_LABEL: Record<string, string> = {
  INSERT: "is created",
  UPDATE: "is updated",
  INSERT_OR_UPDATE: "is created or updated",
  INACTIVITY: "goes inactive",
};

export function TriggerCard({
  entityType, triggerEvent, inactivityDays, reentryPolicy,
}: {
  entityType: string; triggerEvent: string; inactivityDays: number | null; reentryPolicy: string;
}) {
  return (
    <div className="ec-fb-trigger">
      <div className="ec-fb-trigger-label">Trigger</div>
      <div className="ec-fb-trigger-text">
        When a <b>{entityType}</b> {TRIGGER_LABEL[triggerEvent] ?? triggerEvent}
        {triggerEvent === "INACTIVITY" && inactivityDays ? ` for ${inactivityDays} days` : ""}
      </div>
      <div className="ec-fb-trigger-meta">
        Re-entry: {reentryPolicy.toLowerCase()}
      </div>
    </div>
  );
}
