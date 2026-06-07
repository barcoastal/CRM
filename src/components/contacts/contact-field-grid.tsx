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

/** Helper to build an editable row tuple — mirrors the section.tsx `E` helper. */
export function CE(
  label: string,
  value: ReactNode,
  fieldKey: string,
  type: FieldType = "text",
  opts?: { rawValue?: string | number | boolean | Date | null; options?: { label: string; value: string }[]; editable?: boolean },
): ContactGridField {
  return [
    label,
    value,
    {
      fieldKey,
      type,
      rawValue: opts?.rawValue ?? (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null),
      options: opts?.options,
      editable: opts?.editable,
    },
  ];
}

export function ContactField({ label, value }: { label: string; value: ReactNode }) {
  // Spacer cells used to align two-column rows skip rendering entirely.
  if (label === "__PAD__") {
    return <div aria-hidden="true" style={{ minHeight: 32, padding: "8px 0" }} />;
  }
  const isEmpty = value == null || value === "" || value === false;
  return (
    <div
      className="sfc-field"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 165px) 1fr 24px",
        alignItems: "start",
        gap: 12,
        padding: "8px 0",
        minHeight: 32,
        borderBottom: "1px solid #ecebea",
        fontSize: 13,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          color: "#3e3e3c",
          fontWeight: 400,
          fontSize: 12,
          paddingTop: 1,
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#080707",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {isEmpty ? <span style={{ color: "#b0adab" }}>{"—"}</span> : value}
      </div>
      {/* Spacer keeps the 3-column grid intact. Read-only ContactField rows
          intentionally render NO pencil. Only rows wired via CE() +
          InlineEditableField show a clickable pencil. A static pencil here
          previously mislead users into clicking a dead control. */}
      <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 24 }} />
      <style jsx>{`
        :global(.sfc-field:hover) {
          background: #fafaf9;
        }
      `}</style>
    </div>
  );
}
