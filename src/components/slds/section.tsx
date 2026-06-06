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
  opts?: { rawValue?: string | number | boolean | Date | null; options?: { label: string; value: string }[]; editable?: boolean },
): GridField {
  return [
    label,
    value,
    {
      fieldKey,
      type,
      rawValue: opts?.rawValue ?? extractRaw(value),
      options: opts?.options,
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
        border: "1px solid #dddbda",
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
          borderBottom: open ? "1px solid #dddbda" : "none",
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
            fill: "#706e6b",
            flexShrink: 0,
          }}
        >
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#080707", letterSpacing: 0 }}>{title}</span>
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
        columnGap: 0,
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
              editable={edit.editable !== false}
            />
          );
        }
        return <Field key={i} label={label} value={value} />;
      })}
      <style jsx>{`
        /* SF Lightning: vertical separator between the two columns.
           Left column (odd cells) gets a right border + right padding;
           right column (even cells) gets left padding for breathing room. */
        :global(.sf-field-grid--2col > .sf-field:nth-child(odd)) {
          border-right: 1px solid #dddbda;
          padding-right: 16px;
        }
        :global(.sf-field-grid--2col > .sf-field:nth-child(even)) {
          padding-left: 16px;
        }
      `}</style>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  // SF Lightning record-page field row (verified against
  // docs/sf-screenshots/sf-lead-detail.png): LABEL ON TOP (gray, small),
  // VALUE BELOW (black, regular), edit pencil top-right. This matches the
  // canonical Lightning Output Field component (`.slds-form-element_stacked`),
  // not the horizontal Account-edit layout.
  return (
    <div
      style={{
        padding: "8px 0 10px",
        minHeight: 56,
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 28px",
        gap: "2px 8px",
      }}
      className="sf-field"
    >
      <div
        style={{
          gridColumn: "1 / -1",
          fontSize: 12,
          color: "#3e3e3c",
          fontWeight: 400,
          lineHeight: 1.35,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#080707",
          wordBreak: "break-word",
          lineHeight: 1.4,
          minWidth: 0,
        }}
      >
        {value != null && value !== "" ? value : (
          <span aria-hidden="true" style={{ color: "transparent" }}>-</span>
        )}
      </div>
      <button
        aria-label="Edit"
        className="sf-field-edit"
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 4,
          opacity: 0.55,
          transition: "opacity .15s",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 3,
          alignSelf: "start",
          marginTop: -2,
        }}
      >
        <svg
          aria-hidden="true"
          width="13"
          height="13"
          viewBox="0 0 52 52"
          style={{ fill: "#54698d" }}
        >
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
        </svg>
      </button>
      <style jsx>{`
        :global(.sf-field) {
          border-bottom: 1px solid #dddbda;
        }
        :global(.sf-field:hover .sf-field-edit) {
          opacity: 1;
        }
        :global(.sf-field-edit:hover) {
          background: #f3f2f2;
        }
      `}</style>
    </div>
  );
}
