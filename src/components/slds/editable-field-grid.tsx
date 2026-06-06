"use client";

import type { ReactNode } from "react";
import { InlineEditableField, type EntityType, type FieldType } from "./inline-editable-field";

/**
 * SF-style 2-column field grid where every row is an InlineEditableField.
 * Each field spec describes how to render + edit a single field.
 *
 * The spec carries the entity context once so per-page call sites stay readable
 * (mirrors the legacy [label, value] tuples but with an extra fieldKey + type).
 */
export interface EditableFieldSpec {
  label: string;
  /** Raw underlying value (string | number | boolean | Date | null). */
  value?: string | number | boolean | Date | null;
  /** Pre-rendered display node when the raw value isn't enough (e.g. a Link). */
  display?: ReactNode;
  /** Database / SF field key used in the PATCH body. */
  fieldKey?: string;
  /** Input type. Default 'text'. */
  type?: FieldType;
  /** Option list when type = 'select'. */
  options?: { label: string; value: string }[];
  /** Marks the row as read-only (no pencil). */
  editable?: boolean;
  /** Custom formatter for the display string. */
  format?: (v: string | number | boolean | null | undefined) => ReactNode;
}

export function EditableFieldGrid({
  fields,
  entityType,
  entityId,
  columns = 2,
}: {
  fields: EditableFieldSpec[];
  entityType: EntityType;
  entityId: string;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={columns === 2 ? "sf-edit-grid sf-edit-grid--2col" : "sf-edit-grid"}
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "1fr 1fr",
        columnGap: 32,
      }}
    >
      {fields.map((f, i) => {
        // Pad cells render an empty placeholder for column alignment.
        if (f.label === "__PAD__") {
          return <div key={i} aria-hidden="true" style={{ minHeight: 32, padding: "8px 0" }} />;
        }
        // Non-editable rows skip the pencil but still match the row height.
        const editable = f.editable !== false && Boolean(f.fieldKey);
        const valueForInput = normalizeValue(f.value);
        return (
          <InlineEditableField
            key={i}
            label={f.label}
            value={valueForInput}
            displayNode={f.display}
            fieldKey={f.fieldKey ?? "__none__"}
            entityType={entityType}
            entityId={entityId}
            type={f.type ?? "text"}
            options={f.options}
            editable={editable}
            format={f.format}
          />
        );
      })}
    </div>
  );
}

function normalizeValue(v: EditableFieldSpec["value"]): string | number | boolean | null | undefined {
  if (v instanceof Date) return v.toISOString();
  return v;
}
