"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ENTITY_FIELD_OPTIONS,
  formatFieldValue,
  getFieldOption,
  type EntityKey,
} from "@/lib/path/field-labels";
import { resolveFieldValue, isFieldFilled } from "@/lib/path/field-values";
import { MiniMarkdown } from "@/lib/path/markdown";

/**
 * SF-style Path side panel. Two stacked white cards that sit alongside (or
 * below) the Path tracker on a record detail page:
 *
 *   ┌─ Key Fields ─────────┐  ┌─ Guidance for Success ──┐
 *   │ ✓ Name               │  │ Confirm contact info... │
 *   │ ○ Email              │  │                         │
 *   │ ✓ Phone              │  │                         │
 *   └──────────────────────┘  └─────────────────────────┘
 *
 * The component is a client island so the empty-state link can use the
 * pathname-aware Next Link. All resolution work runs locally on the record
 * row already fetched by the server detail page.
 */
export interface PathSidePanelProps {
  entityType: EntityKey;
  stage: string | null | undefined;
  record: Record<string, unknown> | null | undefined;
  /** Pre-fetched guidance from `getGuidance(entityType, stage)`. Null = none. */
  guidance: { keyFields: string[]; guidance: string | null } | null;
  /** When true, render the "Add Guidance" link in the empty state. */
  canEdit?: boolean;
}

export function PathSidePanel({
  entityType,
  stage,
  record,
  guidance,
  canEdit = true,
}: PathSidePanelProps) {
  const keyFields = guidance?.keyFields ?? [];
  const fieldRows = useMemo(() => {
    return keyFields.map((path) => {
      const opt = getFieldOption(entityType, path);
      const raw = resolveFieldValue(record ?? null, path);
      const filled = isFieldFilled(raw);
      return {
        path,
        label: opt.label,
        value: filled ? formatFieldValue(raw, opt.format) : "",
        filled,
      };
    });
  }, [entityType, record, keyFields]);

  const guidanceText = guidance?.guidance ?? "";
  const hasAnything = !!guidance && (keyFields.length > 0 || guidanceText.trim().length > 0);

  return (
    <div style={wrap}>
      {/* Key Fields */}
      <div style={cardStyle}>
        <div style={headerBar}>Key Fields</div>
        <div style={bodyStyle}>
          {fieldRows.length === 0 ? (
            <div style={emptyText}>
              {hasAnything
                ? "No key fields configured for this stage."
                : "No key fields configured."}
            </div>
          ) : (
            <ul style={listStyle}>
              {fieldRows.map((f) => (
                <li key={f.path} style={liRowStyle}>
                  <span style={f.filled ? iconCheck : iconDot} aria-hidden>
                    {f.filled ? checkSvg : dotSvg}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={fieldLabelStyle}>{f.label}</div>
                    <div style={fieldValueStyle}>{f.filled ? f.value : "—"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Guidance for Success */}
      <div style={cardStyle}>
        <div style={headerBar}>Guidance for Success</div>
        <div style={bodyStyle}>
          {guidanceText.trim() ? (
            <MiniMarkdown source={guidanceText} />
          ) : (
            <div style={emptyText}>
              {guidance == null
                ? "No guidance configured for this stage."
                : "No guidance configured for this stage."}
              {canEdit && guidance == null && stage && hasField(entityType) && (
                <>
                  {" "}
                  <Link
                    href={`/settings/path-guidance/new?entity=${encodeURIComponent(
                      entityType,
                    )}&stage=${encodeURIComponent(stage)}`}
                    style={addLinkStyle}
                  >
                    Add Guidance
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function hasField(entity: EntityKey): boolean {
  return Array.isArray(ENTITY_FIELD_OPTIONS[entity]);
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 8,
  marginBottom: 8,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  overflow: "hidden",
};

const headerBar: React.CSSProperties = {
  background: "#f3f3f3",
  borderBottom: "1px solid #c9c9c9",
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const bodyStyle: React.CSSProperties = {
  padding: "12px 14px",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const liRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
};

const iconCheck: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "#04844b",
  color: "#fff",
  flexShrink: 0,
  marginTop: 2,
};
const iconDot: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "#ecebea",
  color: "#747474",
  flexShrink: 0,
  marginTop: 2,
};

const checkSvg = (
  <svg width="10" height="10" viewBox="0 0 12 12" style={{ fill: "#fff" }}>
    <path d="M4.5 8.5L2 6l-1 1 3.5 3.5L11 4l-1-1z" />
  </svg>
);
const dotSvg = (
  <svg width="6" height="6" viewBox="0 0 6 6" style={{ fill: "#747474" }}>
    <circle cx="3" cy="3" r="3" />
  </svg>
);

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  lineHeight: 1.4,
};
const fieldValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#181818",
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const emptyText: React.CSSProperties = {
  fontSize: 13,
  color: "#747474",
  lineHeight: 1.5,
};
const addLinkStyle: React.CSSProperties = {
  color: "#0176d3",
  textDecoration: "none",
  marginLeft: 4,
};
