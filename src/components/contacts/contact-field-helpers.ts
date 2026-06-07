/**
 * Server-safe helpers for building ContactFieldGrid rows.
 *
 * IMPORTANT: this file must NOT carry a "use client" directive. The
 * ContactFieldGrid component lives in contact-field-grid.tsx which IS a client
 * module — calling any plain (non-component) function exported from a
 * "use client" module from a Server Component throws "Attempted to call CE()
 * from the server but CE is on the client." because the export is replaced
 * with a client-reference proxy.
 *
 * CE() is called from the server component
 * src/app/(dashboard)/contacts/[id]/page.tsx so it must be importable from a
 * non-client module. The runtime type identifiers (FieldType) are erased at
 * compile time via `import type`, so they don't pull in the client module.
 */

import type { ReactNode } from "react";
import type { FieldType } from "@/components/slds/inline-editable-field";
import type { ContactFieldEditMeta, ContactGridField } from "./contact-field-grid";

/**
 * Build a 3-tuple `[label, value, edit]` for inline editing of a Contact field.
 *
 *   CE("Phone", phone, "phone", "phone")
 *   CE("Lead Source", source, "source", "select", { options: SOURCES })
 */
export function CE(
  label: string,
  value: ReactNode,
  fieldKey: string,
  type: FieldType = "text",
  opts?: { rawValue?: string | number | boolean | Date | null; options?: { label: string; value: string }[]; editable?: boolean },
): ContactGridField {
  const meta: ContactFieldEditMeta = {
    fieldKey,
    type,
    rawValue:
      opts?.rawValue ??
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? (value as string | number | boolean)
        : null),
    options: opts?.options,
    editable: opts?.editable,
  };
  return [label, value, meta];
}
