"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ENTITY_FIELD_OPTIONS,
  ENTITY_KEYS,
  type EntityKey,
} from "@/lib/path/field-labels";
import { ENTITY_STAGES } from "@/lib/path/stages";
import { MiniMarkdown } from "@/lib/path/markdown";

export interface PathGuidanceFormInitial {
  id?: string;
  entityType?: string;
  stage?: string;
  keyFields?: string[];
  guidance?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function PathGuidanceForm({
  initial,
  mode,
}: {
  initial?: PathGuidanceFormInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const initialEntity = (initial?.entityType as EntityKey | undefined) ?? "Lead";

  const [entityType, setEntityType] = useState<EntityKey>(initialEntity);
  const [stage, setStage] = useState<string>(initial?.stage ?? "");
  const [keyFields, setKeyFields] = useState<string[]>(initial?.keyFields ?? []);
  const [guidance, setGuidance] = useState<string>(initial?.guidance ?? "");
  const [sortOrder, setSortOrder] = useState<number>(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fieldOptions = useMemo(() => ENTITY_FIELD_OPTIONS[entityType] ?? [], [entityType]);
  const stageOptions = useMemo(() => ENTITY_STAGES[entityType] ?? [], [entityType]);

  // When entity changes in create mode, clear stage + key fields that no
  // longer belong to the new entity.
  function handleEntityChange(next: EntityKey) {
    if (mode === "edit") return;
    setEntityType(next);
    if (!ENTITY_STAGES[next].includes(stage)) setStage("");
    setKeyFields((kf) =>
      kf.filter((p) => ENTITY_FIELD_OPTIONS[next].some((opt) => opt.path === p)),
    );
  }

  function toggleField(path: string) {
    setKeyFields((cur) =>
      cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!stage) {
      setErr("Stage is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        entityType,
        stage,
        keyFields,
        guidance: guidance.trim() ? guidance : null,
        sortOrder,
        isActive,
      };
      const res = await fetch(
        mode === "create"
          ? "/api/path-guidance"
          : `/api/path-guidance/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Save failed (${res.status})`);
      }
      router.push("/settings/path-guidance");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial?.id) return;
    if (!confirm("Delete this guidance row? Reps will lose the panel for this stage.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/path-guidance/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/settings/path-guidance");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "Manrope, system-ui, sans-serif" }}>
      <header style={pageHeader}>
        <div>
          <Link href="/settings/path-guidance" style={backLink}>← Path Guidance</Link>
          <h1 style={pageTitle}>
            {mode === "create" ? "New Path Guidance" : "Edit Path Guidance"}
          </h1>
        </div>
      </header>

      <form onSubmit={submit}>
        <div style={twoCol}>
          {/* Left: form */}
          <div style={card}>
            <Field label="Entity">
              <select
                value={entityType}
                onChange={(e) => handleEntityChange(e.target.value as EntityKey)}
                disabled={mode === "edit"}
                style={selectStyle}
              >
                {ENTITY_KEYS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </Field>

            <Field label="Stage">
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select a stage...</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Key Fields">
              <div style={multiSelectBox}>
                {fieldOptions.length === 0 ? (
                  <div style={muted}>No fields registered for {entityType}.</div>
                ) : (
                  fieldOptions.map((opt) => {
                    const checked = keyFields.includes(opt.path);
                    return (
                      <label key={opt.path} style={checkboxRow}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(opt.path)}
                        />
                        <span style={{ fontWeight: checked ? 600 : 400 }}>{opt.label}</span>
                        <code style={pathCode}>{opt.path}</code>
                      </label>
                    );
                  })
                )}
              </div>
              <div style={hint}>
                SF surfaces 3-5 key fields per stage. Pick the ones the rep should
                fill before advancing.
              </div>
            </Field>

            <Field label="Guidance (markdown)">
              <textarea
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                rows={12}
                placeholder="What should the rep do at this stage? Supports # h1, ## h2, **bold**, *italic*, - bullets, > blockquote."
                style={textareaStyle}
              />
            </Field>

            <Field label="Sort Order">
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </Field>

            <Field label="">
              <label style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Active</span>
              </label>
            </Field>
          </div>

          {/* Right: live preview */}
          <div>
            <div style={previewHeader}>Live Preview</div>
            <div style={previewCard}>
              <div style={previewBar}>Guidance for Success</div>
              <div style={previewBody}>
                {guidance.trim() ? (
                  <MiniMarkdown source={guidance} />
                ) : (
                  <div style={muted}>Preview will appear as you type.</div>
                )}
              </div>
            </div>
            <div style={{ ...previewCard, marginTop: 12 }}>
              <div style={previewBar}>Key Fields ({keyFields.length})</div>
              <div style={previewBody}>
                {keyFields.length === 0 ? (
                  <div style={muted}>No fields selected.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {keyFields.map((p) => {
                      const opt = fieldOptions.find((f) => f.path === p);
                      return (
                        <li key={p} style={{ fontSize: 13, color: "#3e3e3c" }}>
                          {opt?.label ?? p}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {err && <div style={errBox}>{err}</div>}

        <div style={footer}>
          <Link href="/settings/path-guidance" style={cancelBtn}>Cancel</Link>
          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              style={dangerBtn}
            >
              Delete
            </button>
          )}
          <button type="submit" disabled={saving} style={saveBtn}>
            {saving ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={fieldLabel}>{label}</div>}
      {children}
    </div>
  );
}

const pageHeader: React.CSSProperties = {
  background: "#fff",
  padding: "16px 24px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 16,
};
const pageTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#0a0a0a",
  margin: "4px 0 0",
};
const backLink: React.CSSProperties = {
  fontSize: 12,
  color: "#3052ff",
  textDecoration: "none",
  fontWeight: 600,
};
const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: 16,
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 20,
};
const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#54595e",
  marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "Manrope, system-ui, sans-serif",
  color: "#0a0a0a",
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };
const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 200,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 12,
  lineHeight: 1.5,
};
const multiSelectBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: 8,
  maxHeight: 240,
  overflowY: "auto",
  background: "#fafafa",
};
const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 6px",
  fontSize: 13,
  color: "#0a0a0a",
  cursor: "pointer",
};
const pathCode: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  background: "#f3f4f6",
  padding: "1px 6px",
  borderRadius: 4,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  marginLeft: "auto",
};
const hint: React.CSSProperties = { fontSize: 11, color: "#6b7280", marginTop: 6 };
const muted: React.CSSProperties = { fontSize: 13, color: "#9ca3af" };
const previewHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#54595e",
  marginBottom: 6,
};
const previewCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  overflow: "hidden",
};
const previewBar: React.CSSProperties = {
  background: "#f3f3f3",
  borderBottom: "1px solid #d8dde6",
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const previewBody: React.CSSProperties = { padding: "12px 14px" };
const footer: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};
const cancelBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  background: "#fff",
  border: "1px solid #e5e7eb",
  color: "#0a0a0a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const saveBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  background: "#3052ff",
  border: "1px solid #3052ff",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const dangerBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  background: "#fff",
  border: "1px solid #ba0517",
  color: "#ba0517",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const errBox: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 6,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
};
