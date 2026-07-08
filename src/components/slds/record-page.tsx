import type { ReactNode } from "react";
import { ObjectHeader, type ObjectHeaderField } from "./object-header";
import { Path, type PathStage } from "./path";

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
  details: ReactNode;
  rail?: ReactNode;
}) {
  return (
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
          actionLabel={pathActionLabel ?? "Mark Current Stage"}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: rail ? "minmax(0, 1fr) minmax(320px, 360px)" : "minmax(0, 1fr)",
          gap: 12,
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
  return (
    <>
      {buttons.map((b, i) =>
        b.href ? (
          <a
            key={i}
            href={b.href}
            className={`slds-button ${b.primary ? "slds-button_brand" : "slds-button_neutral"}`}
          >
            {b.label}
          </a>
        ) : (
          <button
            key={i}
            className={`slds-button ${b.primary ? "slds-button_brand" : "slds-button_neutral"}`}
            onClick={b.onClick}
          >
            {b.label}
          </button>
        ),
      )}
      <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="More">
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "#181818" }}>
          <circle cx="2" cy="7" r="1.5" /><circle cx="7" cy="7" r="1.5" /><circle cx="12" cy="7" r="1.5" />
        </svg>
      </button>
    </>
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
