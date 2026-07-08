"use client";

import { useState, type ReactNode } from "react";
import { InlineEditableField, type EntityType, type FieldType } from "./inline-editable-field";

/**
 * Edit metadata appended to a FieldGrid tuple to make the row inline-editable.
 * When present (and entityType + entityId are provided to the FieldGrid), the
 * row renders an InlineEditableField with a pencil next to the value. Without
 * meta, the row stays read-only.
 */
export interface FieldEditMeta {
  fieldKey: string;
  type?: FieldType;
  rawValue?: string | number | boolean | Date | null;
  options?: { label: string; value: string }[];
  lookupEndpoint?: string;
  editable?: boolean;
}

export type GridField =
  | [label: string, value: ReactNode]
  | [label: string, value: ReactNode, edit: FieldEditMeta];

/**
 * Build a 3-tuple `[label, value, edit]` for inline editing. Helps keep the
 * call sites readable.
 *
 *   E("Phone", phone, "phone", "phone")
 *   E("Lead Source", source, "source", "select", { options: SOURCES })
 */
export function E(
  label: string,
  value: ReactNode,
  fieldKey: string,
  type: FieldType = "text",
  opts?: { rawValue?: string | number | boolean | Date | null; options?: { label: string; value: string }[]; lookupEndpoint?: string; editable?: boolean },
): GridField {
  return [
    label,
    value,
    {
      fieldKey,
      type,
      rawValue: opts?.rawValue ?? extractRaw(value),
      options: opts?.options,
      lookupEndpoint: opts?.lookupEndpoint,
      editable: opts?.editable,
    },
  ];
}

function extractRaw(v: ReactNode): string | number | boolean | null {
  if (v == null || typeof v === "boolean") return v as boolean | null;
  if (typeof v === "string" || typeof v === "number") return v;
  return null;
}

/**
 * SF Lightning record-page section: collapsible title bar with a chevron,
 * 2-column field grid below. Each field has its label on top + value below
 * with an inline edit pencil icon on hover (visual only here).
 */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "#fafaf9",
          border: 0,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          borderBottom: open ? "1px solid #c9c9c9" : "none",
          minHeight: 36,
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 10 10"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform .15s",
            fill: "#747474",
            flexShrink: 0,
          }}
        >
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181818", letterSpacing: 0 }}>{title}</span>
      </button>
      {open && <div style={{ padding: "8px 16px" }}>{children}</div>}
    </div>
  );
}

/**
 * 2-column field grid as used on SF record pages. Pass an array of
 * [label, value] (read-only) or [label, value, edit] (inline-editable) tuples.
 *
 * When `entityType` + `entityId` are provided, any row carrying edit metadata
 * renders as an InlineEditableField — the pencil sits next to the value and
 * click swaps to an input with save / cancel buttons (SF Lightning parity).
 */
export function FieldGrid({
  fields,
  columns = 2,
  entityType,
  entityId,
}: {
  fields: GridField[];
  columns?: 1 | 2;
  entityType?: EntityType;
  entityId?: string;
}) {
  return (
    <div
      className={columns === 2 ? "sf-field-grid sf-field-grid--2col" : "sf-field-grid"}
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "1fr 1fr",
        // SF Lightning separates the two columns with a plain gutter - no
        // vertical divider line.
        columnGap: 32,
      }}
    >
      {fields.map((row, i) => {
        const [label, value, edit] = row;
        if (edit && entityType && entityId) {
          const raw = edit.rawValue instanceof Date ? edit.rawValue.toISOString() : edit.rawValue ?? null;
          return (
            <InlineEditableField
              key={i}
              label={label}
              value={raw}
              displayNode={value}
              fieldKey={edit.fieldKey}
              entityType={entityType}
              entityId={entityId}
              type={edit.type ?? "text"}
              options={edit.options}
              lookupEndpoint={edit.lookupEndpoint}
              editable={edit.editable !== false}
            />
          );
        }
        return <Field key={i} label={label} value={value} />;
      })}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  // SF Lightning record-page field row (measured from the live org):
  // 12px regular #444 labels, 13px #181818 values, 32px min row height,
  // subtle #e5e5e5 underline. Horizontal layout: label 33% | value | 28px.
  return (
    <div
      style={{
        padding: "4px 0",
        minHeight: 28,
        position: "relative",
        display: "grid",
        gridTemplateColumns: "33% 1fr 28px",
        alignItems: "start",
        gap: 8,
      }}
      className="sf-field"
    >
      <div
        style={{
          fontSize: 12,
          color: "#444444",
          fontWeight: 400,
          lineHeight: 1.35,
          paddingTop: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#181818",
          wordBreak: "break-word",
          lineHeight: 1.35,
          minWidth: 0,
        }}
      >
        {value != null && value !== "" ? value : (
          <span aria-hidden="true" style={{ color: "transparent" }}>-</span>
        )}
      </div>
      {/* Spacer to preserve the 3-column grid layout. Read-only Field rows
          intentionally render NO pencil — the pencil only appears on rows
          wired through the E() helper + InlineEditableField, where clicking
          it actually opens an inline editor. Rendering a static pencil here
          mislead users into clicking a dead control. */}
      <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 24 }} />
      <style jsx>{`
        :global(.sf-field) {
          border-bottom: 1px solid #e5e5e5;
        }
      `}</style>
    </div>
  );
}
