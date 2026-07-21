"use client";

/**
 * SF Lightning Path component — the green chevron stage bar that sits on
 * record pages between the highlights and the tab nav.
 *
 * Each stage is a chevron-shaped step. Completed stages are filled green
 * with a checkmark, the current stage is bold-bordered and slightly wider,
 * upcoming stages are light gray. To the right is a primary action button
 * ("Mark as Complete", "Change Closed Stage", etc.).
 */

export interface PathStage {
  label: string;
  /** Optional sub-label (e.g. "First Payment Completed") */
  sublabel?: string;
}

/**
 * Wiring for the action button: same as SF, clicking "Mark ... Complete"
 * advances the record to the next stage. Pages pass the entity route + the
 * actual next stage value; the button PATCHes the field endpoint and reloads.
 */
export interface PathAdvance {
  /** API route segment, e.g. "opportunities" | "leads" | "accounts". */
  entity: string;
  entityId: string;
  /** The stage value to set when clicked. Null = terminal stage (button disabled). */
  nextStage: string | null;
  /** Field to PATCH (default "stage"). */
  fieldKey?: string;
}

export function Path({
  stages,
  currentIndex,
  actionLabel,
  onAction,
  advance,
}: {
  stages: readonly PathStage[];
  currentIndex: number;
  actionLabel?: string;
  onAction?: () => void;
  advance?: PathAdvance;
}) {
  const handleAction = async () => {
    if (onAction) return onAction();
    if (!advance?.nextStage) return;
    try {
      const res = await fetch(`/api/${advance.entity}/${advance.entityId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [advance.fieldKey ?? "stage"]: advance.nextStage }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error || "Could not update the stage.");
        return;
      }
      window.location.reload();
    } catch {
      alert("Could not update the stage.");
    }
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "#fff",
        borderBottom: "1px solid #c9c9c9",
        padding: "10px 16px",
        gap: 0,
      }}
    >
      <div style={{ flex: 1, display: "flex", height: 32, overflow: "hidden" }}>
        {stages.map((stage, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFirst = i === 0;
          const isLast = i === stages.length - 1;
          return (
            <div
              key={i}
              className={`sf-path-step ${
                isDone ? "sf-path-done" : isCurrent ? "sf-path-current" : "sf-path-upcoming"
              }`}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                marginLeft: isFirst ? 0 : -8,
                clipPath: isLast
                  ? "polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)"
                  : isFirst
                  ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                  : "polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)",
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 400,
                color: isDone ? "#fff" : isCurrent ? "#fff" : "#444",
                whiteSpace: "nowrap",
                paddingLeft: isFirst ? 10 : 16,
                paddingRight: isLast ? 10 : 16,
                cursor: "default",
              }}
              title={stage.label}
            >
              {isDone && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  style={{ marginRight: 4, fill: "#fff", flexShrink: 0 }}
                >
                  <path d="M4.5 8.5L2 6l-1 1 3.5 3.5L11 4l-1-1z" />
                </svg>
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* SF renders this as a solid brand-blue button - only on layouts that
          define it (the account path in this org shows no button). */}
      {actionLabel && (
      <button
        onClick={handleAction}
        disabled={!onAction && !advance?.nextStage}
        style={{
          marginLeft: 12,
          background: "#0176d3",
          color: "#fff",
          border: "1px solid #0176d3",
          padding: "0 16px",
          height: 32,
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 400,
          cursor: "pointer",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
          <path d="M20.5 33.4l-7.2-7.1c-.4-.4-1-.4-1.4 0l-1.4 1.4c-.4.4-.4 1 0 1.4l9.3 9.2c.4.4 1 .4 1.4 0L42 17.5c.4-.4.4-1 0-1.4l-1.4-1.4c-.4-.4-1-.4-1.4 0L20.5 33.4z" />
        </svg>
        {actionLabel}
      </button>
      )}

      <style jsx>{`
        :global(.sf-path-step) {
          transition: background .15s;
        }
        :global(.sf-path-done) { background: #3ba755; }
        :global(.sf-path-current) { background: #032d60; }
        :global(.sf-path-upcoming) { background: #f3f3f3; }
        :global(.sf-path-done:hover) { background: #0b683b; }
        :global(.sf-path-upcoming:hover) { background: #ecebea; }
      `}</style>
    </div>
  );
}
