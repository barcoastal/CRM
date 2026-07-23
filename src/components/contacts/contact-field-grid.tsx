"use client";

import type { ReactNode } from "react";
import { InlineEditableField, type EntityType, type FieldType } from "@/components/slds/inline-editable-field";

/**
 * Optional edit metadata appended to a row tuple. Same shape used by the
 * generic FieldGrid `E(...)` helper but kept local so the Contact field grid
 * can also live as a pure read-only grid when no edit context is provided.
 */
export interface ContactFieldEditMeta {
  fieldKey: string;
  type?: FieldType;
  rawValue?: string | number | boolean | Date | null;
  options?: { label: string; value: string }[];
  editable?: boolean;
}

export type ContactGridField =
  | [label: string, value: ReactNode]
  | [label: string, value: ReactNode, edit: ContactFieldEditMeta];

/**
 * SF Lightning Contact detail field grid — label LEFT, value to the right,
 * thin row borders, inline edit pencil at the far right.
 * Two such columns side by side per the SF screenshot.
 */
export function ContactFieldGrid({
  fields,
  columns = 2,
  entityType,
  entityId,
}: {
  fields: ContactGridField[];
  columns?: 1 | 2;
  entityType?: EntityType;
  entityId?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "1fr 1fr",
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
              editable={edit.editable !== false}
            />
          );
        }
        return <ContactField key={i} label={label} value={value} />;
      })}
    </div>
  );
}

/*
 * `CE(...)` helper now lives in `./contact-field-helpers` (no "use client"
 * directive) so it can be called from server components. Re-exporting or
 * re-defining it here would create a client-reference proxy that the
 * server render rejects with "Attempted to call CE() from the server".
 */

export function ContactField({ label, value }: { label: string; value: ReactNode }) {
  // Spacer cells used to align two-column rows skip rendering entirely.
  if (label === "__PAD__") {
    return <div aria-hidden="true" style={{ minHeight: 23, padding: "2px 0" }} />;
  }
  const isEmpty = value == null || value === "" || value === false;
  return (
    <div
      className="sfc-field"
      style={{
        display: "grid",
        gridTemplateColumns: "33% 1fr 24px",
        alignItems: "start",
        gap: 12,
        padding: "2px 0",
        minHeight: 23,
        borderBottom: "1px solid #e5e5e5",
        fontSize: 13,
        lineHeight: 1.25,
      }}
    >
      <div
        style={{
          color: "#181818",
          fontWeight: 700,
          fontSize: 12,
          paddingTop: 1,
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#181818",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {isEmpty ? <span style={{ color: "#b0adab" }}>{"-"}</span> : value}
      </div>
      {/* Spacer keeps the 3-column grid intact. Read-only ContactField rows
          intentionally render NO pencil. Only rows wired via CE() +
          InlineEditableField show a clickable pencil. A static pencil here
          previously mislead users into clicking a dead control. */}
      <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 18 }} />
      <style jsx>{`
        :global(.sfc-field:hover) {
          background: #fafaf9;
        }
      `}</style>
    </div>
  );
}
