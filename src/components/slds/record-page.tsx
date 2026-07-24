import type { ReactNode } from "react";
import { ObjectHeader, type ObjectHeaderField } from "./object-header";
import { Path, type PathStage, type PathAdvance } from "./path";

/**
 * Canonical SF Lightning record-page layout:
 *   [Object header w/ icon + name + highlights + actions]
 *   [Optional Path component]
 *   [Optional sub-nav tabs]
 *   [Two-col body: details left, related rail right]
 */
export function RecordPage({
  entity,
  entityLabel,
  recordTitle,
  recordSubtitle,
  highlights = [],
  actions,
  pathStages,
  pathCurrentIndex,
  pathActionLabel,
  pathAdvance,
  pathDoneVariant,
  pathCurrentColor,
  details,
  rail,
}: {
  entity: string;
  entityLabel?: string;
  recordTitle: string;
  recordSubtitle?: ReactNode;
  highlights?: ObjectHeaderField[];
  actions?: ReactNode;
  pathStages?: readonly PathStage[];
  pathCurrentIndex?: number;
  pathActionLabel?: string;
  pathAdvance?: PathAdvance;
  pathDoneVariant?: "plain" | "green";
  pathCurrentColor?: string;
  details: ReactNode;
  rail?: ReactNode;
}) {
  return (
    <div>
      {/* SF record pages sit the header + path on a light-blue textured
          backdrop (the Lightning "header image"). The band bleeds to the
          page edges (negative margin over the 12px page padding). */}
      <div>
        <ObjectHeader
          entity={entity}
          entityLabel={entityLabel}
          recordTitle={recordTitle}
          recordSubtitle={recordSubtitle}
          highlights={highlights}
          actions={actions}
        />
        {pathStages && typeof pathCurrentIndex === "number" && (
          <Path
            stages={pathStages}
            currentIndex={pathCurrentIndex}
            actionLabel={pathActionLabel}
            advance={pathAdvance}
            doneVariant={pathDoneVariant}
            currentColor={pathCurrentColor}
          />
        )}
      </div>
      <div
        style={{
          display: "grid",
          // SF Lightning's right sidebar region is 1/3 of the content width
          // (measured 624px at a 1905px viewport). 2fr/1fr matches it.
          gridTemplateColumns: rail ? "minmax(0, 2fr) minmax(320px, 1fr)" : "minmax(0, 1fr)",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div>{details}</div>
        {rail && <div>{rail}</div>}
      </div>
    </div>
  );
}

/**
 * Action button strip used in record-page headers. Pass an array of label/href/onClick.
 */
export function HeaderActions({
  buttons,
}: {
  buttons: { label: string; href?: string; onClick?: () => void; primary?: boolean }[];
}) {
  // SF renders record actions as ONE joined button group with a trailing chevron.
  const groupItem: React.CSSProperties = {
    background: "#fff", border: 0, color: "#0176d3", padding: "0 12px", height: 30,
    fontSize: 13, fontWeight: 400, cursor: "pointer", display: "inline-flex",
    alignItems: "center", textDecoration: "none", whiteSpace: "nowrap",
  };
  return (
    <span style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
      {buttons.map((b, i) => {
        const style = { ...groupItem, ...(i > 0 ? { borderLeft: "1px solid #c9c9c9" } : {}) };
        return b.href ? (
          <a key={i} href={b.href} style={style}>{b.label}</a>
        ) : (
          <button key={i} style={style} onClick={b.onClick}>{b.label}</button>
        );
      })}
      <button style={{ ...groupItem, borderLeft: "1px solid #c9c9c9", padding: "0 10px" }} title="More" aria-label="More">
        <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "#0176d3" }}>
          <path d="M0 2l5 6 5-6z" />
        </svg>
      </button>
    </span>
  );
}

/**
 * SF-style status badge pill. Color coded by tone.
 */
export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const colors: Record<typeof tone, { bg: string; color: string }> = {
    success: { bg: "#2e844a", color: "#fff" },
    warning: { bg: "#fe9339", color: "#fff" },
    danger: { bg: "#ba0517", color: "#fff" },
    info: { bg: "#0176d3", color: "#fff" },
    neutral: { bg: "#ecebea", color: "#444444" },
  };
  const c = colors[tone];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        display: "inline-block",
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}
