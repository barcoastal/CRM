"use client";

/**
 * SF-parity record Edit modal: centered dialog, "Edit <Record>" title with X,
 * two-column grid of stacked label-above-input fields, "* = Required
 * Information" note, centered footer with Cancel | Save.
 *
 * Saves by PATCHing each dirty field to `${endpointBase}` one at a time,
 * matching the /api/<entity>/<id>/field contract (exactly one field per call).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface EditField {
  label: string;
  /** Field key accepted by the /field PATCH endpoint (column or SF api name). */
  key: string;
  type?: "text" | "phone" | "email" | "date" | "checkbox" | "textarea" | "select";
  value: string | boolean | null;
  /** Options for type "select". */
  options?: { value: string; label: string }[];
  readOnly?: boolean;
  required?: boolean;
}

export function RecordEditModal({
  recordTitle,
  endpointBase,
  fields,
  open,
  onClose,
}: {
  recordTitle: string;
  endpointBase: string;
  fields: EditField[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | boolean | null>>({});
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const valueOf = (f: EditField) => (f.key in values ? values[f.key] : f.value);

  async function save() {
    setSaving(true);
    const dirty = fields.filter((f) => f.key in values && values[f.key] !== f.value && !f.readOnly);
    let failed = 0;
    for (const f of dirty) {
      try {
        const res = await fetch(endpointBase, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [f.key]: values[f.key] }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }
    setSaving(false);
    if (failed > 0) {
      toast.error(`${failed} field${failed > 1 ? "s" : ""} could not be saved`);
    } else if (dirty.length > 0) {
      toast.success("Saved");
    }
    router.refresh();
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 32,
    border: "1px solid #c9c9c9",
    borderRadius: 4,
    padding: "0 12px",
    fontSize: 13,
    color: "#181818",
    fontFamily: "inherit",
    background: "#fff",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(8,7,7,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 16px",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: "#fff",
          borderRadius: 8,
          width: "min(920px, 100%)",
          maxHeight: "calc(100vh - 96px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <header style={{ position: "relative", padding: "16px 24px 12px", borderBottom: "1px solid #e5e5e5" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, color: "#181818", textAlign: "center" }}>
            Edit {recordTitle}
          </h2>
          <button
            aria-label="Cancel and close"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              width: 32,
              height: 32,
              fontSize: 18,
              color: "#747474",
            }}
          >
            ✕
          </button>
        </header>

        <div style={{ overflowY: "auto", padding: "12px 40px 20px" }}>
          <div style={{ fontSize: 12, color: "#444444", textAlign: "right", padding: "4px 0 8px" }}>
            <abbr style={{ color: "#ba0517", textDecoration: "none" }}>*</abbr> = Required Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 32, rowGap: 2 }}>
            {fields.map((f) => (
              <div key={f.key} style={{ padding: "4px 0", gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}>
                <label style={{ display: "block", fontSize: 12, color: "#444444", marginBottom: 3 }}>
                  {f.required && <span style={{ color: "#ba0517", marginRight: 2 }}>*</span>}
                  {f.label}
                </label>
                {f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(valueOf(f) === true || valueOf(f) === "true" || valueOf(f) === "Yes")}
                    disabled={f.readOnly}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
                    style={{ width: 16, height: 16, marginTop: 6 }}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={String(valueOf(f) ?? "")}
                    disabled={f.readOnly}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">--None--</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={String(valueOf(f) ?? "")}
                    disabled={f.readOnly}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    style={{ ...inputStyle, height: 72, padding: "6px 12px", resize: "vertical" }}
                  />
                ) : (
                  <input
                    type={f.type === "date" ? "date" : "text"}
                    value={String(valueOf(f) ?? "")}
                    disabled={f.readOnly}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    style={{ ...inputStyle, background: f.readOnly ? "#f3f3f3" : "#fff" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <footer
          style={{
            borderTop: "1px solid #e5e5e5",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "center",
            gap: 8,
            background: "#f3f3f3",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              height: 32,
              padding: "0 16px",
              fontSize: 13,
              color: "#0176d3",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            style={{
              background: "#0176d3",
              border: "1px solid #0176d3",
              borderRadius: 4,
              height: 32,
              padding: "0 16px",
              fontSize: 13,
              color: "#fff",
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
