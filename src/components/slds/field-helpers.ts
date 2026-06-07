/**
 * Server-safe helpers for building FieldGrid rows.
 *
 * IMPORTANT: this file must NOT carry a "use client" directive. The Section /
 * FieldGrid components live in section.tsx which IS a client module — calling
 * any plain (non-component) function exported from a "use client" module from
 * a Server Component throws "An error occurred in the Server Components
 * render" because the export is replaced with a client-reference proxy.
 *
 * E() is called from server-component record-page files (e.g.
 * src/app/(dashboard)/leads/[id]/page.tsx) so it must be importable from a
 * non-client module. The runtime type identifiers (FieldType) are erased at
 * compile time via `import type`, so they don't pull in the client module.
 */

import type { ReactNode } from "react";
import type { FieldType } from "./inline-editable-field";

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
 * Build a 3-tuple `[label, value, edit]` for inline editing.
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

export function extractRaw(v: ReactNode): string | number | boolean | null {
  if (v == null || typeof v === "boolean") return v as boolean | null;
  if (typeof v === "string" || typeof v === "number") return v;
  return null;
}
