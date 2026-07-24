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
  doneVariant = "plain",
  currentColor = "#032d60",
}: {
  stages: readonly PathStage[];
  currentIndex: number;
  actionLabel?: string;
  onAction?: () => void;
  advance?: PathAdvance;
  /** "green": SF opportunity style - completed stages are green with a white
   *  check and no label. "plain": SF account/lead style - light gray. */
  doneVariant?: "plain" | "green";
  /** Current-stage fill (SF: navy, but dark green #2e844a for Closed Won). */
  currentColor?: string;
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
        border: "1px solid #c9c9c9",
        borderRadius: 8,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
        padding: "6px 12px",
        gap: 0,
        marginTop: 8,
      }}
    >
      <div style={{ flex: 1, display: "flex", height: 32, overflow: "hidden", borderRadius: 16 }}>
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
                // SF chevrons point RIGHT: the left edge is an inward notch
                // (cut by the previous stage's arrow), the right edge is the
                // outward arrow tip.
                clipPath: isLast
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)"
                  : isFirst
                  ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                  : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                fontSize: 13,
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? "#fff" : "#444",
                whiteSpace: "nowrap",
                paddingLeft: isFirst ? 10 : 16,
                paddingRight: isLast ? 10 : 16,
                cursor: "default",
                ...(isDone && doneVariant === "green" ? { background: "#3ba755" } : {}),
                ...(isCurrent ? { background: currentColor } : {}),
              }}
              title={stage.label}
            >
              {isDone && doneVariant === "green" ? (
                // SF opp path: completed = white check only, no label
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                  {stage.label}
                </span>
              )}
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
        :global(.sf-path-done) { background: #f3f3f3; }
        :global(.sf-path-upcoming) { background: #f3f3f3; }

        :global(.sf-path-upcoming:hover) { background: #ecebea; }
      `}</style>
    </div>
  );
}
