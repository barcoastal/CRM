"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ObjectMeta, FieldMeta } from "@/lib/object-manager/dmmf";

type LabelRow = {
  id: string;
  fieldName: string;
  label: string;
  helpText: string | null;
  isRequired: boolean;
  isReadOnly: boolean;
  sortOrder: number;
};
type LayoutRow = {
  id: string;
  name: string;
  isDefault: boolean;
  recordType: string | null;
  sectionCount: number;
};
type DispositionRow = {
  id: string;
  category: string;
  value: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  stage: string | null;
};

type Tab = "fields" | "picklists" | "layouts";

export function ObjectDetailTabs({
  meta,
  labels,
  layouts,
  dispositions,
  initialTab,
}: {
  meta: ObjectMeta;
  labels: LabelRow[];
  layouts: LayoutRow[];
  dispositions: DispositionRow[];
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div style={tabBar}>
        <TabButton active={tab === "fields"} onClick={() => setTab("fields")}>
          Fields ({meta.fields.length})
        </TabButton>
        <TabButton active={tab === "picklists"} onClick={() => setTab("picklists")}>
          Picklists ({dispositions.length})
        </TabButton>
        <TabButton active={tab === "layouts"} onClick={() => setTab("layouts")}>
          Page Layouts ({layouts.length})
        </TabButton>
      </div>

      {tab === "fields" && <FieldsTab meta={meta} labels={labels} />}
      {tab === "picklists" && (
        <PicklistsTab entity={meta.name} dispositions={dispositions} />
      )}
      {tab === "layouts" && <LayoutsTab entity={meta.name} layouts={layouts} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...tabBtn,
        background: active ? "#fff" : "transparent",
        borderColor: active ? "#3052ff" : "transparent",
        color: active ? "#0a0a0a" : "#54595e",
        fontWeight: active ? 700 : 600,
      }}
    >
      {children}
    </button>
  );
}

// ============ FIELDS TAB ============

function FieldsTab({
  meta,
  labels,
}: {
  meta: ObjectMeta;
  labels: LabelRow[];
}) {
  const labelByField = useMemo(() => {
    const m = new Map<string, LabelRow>();
    for (const l of labels) m.set(l.fieldName, l);
    return m;
  }, [labels]);

  const [editing, setEditing] = useState<FieldMeta | null>(null);

  return (
    <div>
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Required</th>
              <th style={th}>Default</th>
              <th style={th}>Index</th>
              <th style={th}>Label</th>
              <th style={th}>Help Text</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {meta.fields.map((f) => {
              const labelRow = labelByField.get(f.name);
              return (
                <tr key={f.name}>
                  <td style={td}>
                    <code style={fieldCode}>{f.name}</code>
                    {f.documentation && (
                      <div style={fieldDoc}>{f.documentation}</div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={typePill(f.kind)}>{renderType(f)}</span>
                  </td>
                  <td style={td}>
                    {f.isRequired ? (
                      <span style={dotYes}>Yes</span>
                    ) : (
                      <span style={dotNo}>No</span>
                    )}
                  </td>
                  <td style={td}>
                    {f.default ? (
                      <code style={defaultCode}>{f.default}</code>
                    ) : (
                      <span style={muted}>-</span>
                    )}
                  </td>
                  <td style={td}>
                    {f.isId && <span style={indexBadge}>ID</span>}
                    {f.isUnique && <span style={indexBadge}>UNIQUE</span>}
                    {!f.isId && !f.isUnique && <span style={muted}>-</span>}
                  </td>
                  <td style={td}>
                    {labelRow ? (
                      labelRow.label
                    ) : (
                      <span style={muted}>{prettify(f.name)}</span>
                    )}
                  </td>
                  <td style={td}>
                    {labelRow?.helpText ? (
                      <span style={{ fontSize: 12 }}>{labelRow.helpText}</span>
                    ) : (
                      <span style={muted}>-</span>
                    )}
                  </td>
                  <td style={tdRight}>
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      style={editBtn}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <FieldLabelModal
          entity={meta.name}
          field={editing}
          existing={labelByField.get(editing.name) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function renderType(f: FieldMeta): string {
  const base = f.type + (f.isList ? "[]" : "") + (!f.isRequired ? "?" : "");
  if (f.kind === "object") return `relation ${base}`;
  if (f.kind === "enum") return `enum ${base}`;
  return base;
}

function prettify(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/^\s+/, "");
}

function FieldLabelModal({
  entity,
  field,
  existing,
  onClose,
}: {
  entity: string;
  field: FieldMeta;
  existing: LabelRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(existing?.label ?? prettify(field.name));
  const [helpText, setHelpText] = useState(existing?.helpText ?? "");
  const [isRequired, setIsRequired] = useState(existing?.isRequired ?? false);
  const [isReadOnly, setIsReadOnly] = useState(existing?.isReadOnly ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/object-manager/field-labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: entity,
        fieldName: field.name,
        label,
        helpText: helpText || null,
        isRequired,
        isReadOnly,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j?.error ?? `Save failed (${res.status})`);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confirm("Remove this label override?")) return;
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/object-manager/field-labels/${existing.id}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j?.error ?? `Delete failed (${res.status})`);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <div style={modalKicker}>Edit field label</div>
            <div style={modalTitle}>
              {entity}.{field.name}
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>
            Close
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "#54595e", marginBottom: 12 }}>
            Type: <code style={defaultCode}>{renderType(field)}</code>
          </div>

          <label style={fieldLbl}>Display label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
          />

          <label style={fieldLbl}>Help text</label>
          <textarea
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <label style={checkRow}>
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              <span>Required in UI</span>
            </label>
            <label style={checkRow}>
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={(e) => setIsReadOnly(e.target.checked)}
              />
              <span>Read-only in UI</span>
            </label>
          </div>

          {err && <div style={errBox}>{err}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <div>
              {existing && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDelete}
                  style={dangerBtn}
                >
                  Remove override
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose} style={secondaryBtn}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !label.trim()}
                onClick={handleSave}
                style={primaryBtn}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PICKLISTS TAB ============

function PicklistsTab({
  entity,
  dispositions,
}: {
  entity: string;
  dispositions: DispositionRow[];
}) {
  const router = useRouter();
  const grouped = useMemo(() => {
    const m = new Map<string, DispositionRow[]>();
    for (const d of dispositions) {
      const list = m.get(d.category) ?? [];
      list.push(d);
      m.set(d.category, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dispositions]);

  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newCategory.trim() || !newValue.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/object-manager/picklists/${entity}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: newCategory.trim(),
        value: newValue.trim(),
        label: newLabel.trim() || newValue.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? `Add failed (${res.status})`);
      return;
    }
    setAdding(false);
    setNewCategory("");
    setNewValue("");
    setNewLabel("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this picklist value?")) return;
    const res = await fetch(
      `/api/object-manager/picklists/${entity}?id=${id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? `Delete failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div style={panelHeader}>
        <div style={{ fontSize: 13, color: "#54595e" }}>
          Picklist values stored as Disposition rows for entity {entity}. The
          shared Dispositions admin lives at{" "}
          <Link href="/settings/dispositions" style={inlineLink}>
            /settings/dispositions
          </Link>
          .
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} style={primaryBtn}>
          {adding ? "Cancel" : "+ Add Value"}
        </button>
      </div>

      {adding && (
        <div style={addCard}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={fieldLbl}>Category</label>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="SUB_DISPOSITION"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLbl}>Value</label>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="NOT_INTERESTED"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLbl}>Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Not Interested"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ textAlign: "right", marginTop: 10 }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !newCategory.trim() || !newValue.trim()}
              style={primaryBtn}
            >
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div style={emptyCard}>
          No picklist values exist for {entity}. Add one above to get started.
        </div>
      ) : (
        grouped.map(([cat, rows]) => (
          <section key={cat} style={{ marginBottom: 20 }}>
            <h2 style={sectionTitle}>{cat}</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Label</th>
                  <th style={th}>Stored Value</th>
                  <th style={th}>Stage Gate</th>
                  <th style={th}>Active</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td style={td}>{d.label}</td>
                    <td style={td}>
                      <code style={defaultCode}>{d.value}</code>
                    </td>
                    <td style={td}>
                      {d.stage ?? <span style={muted}>any</span>}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          ...pill,
                          background: d.isActive ? "#2e844a" : "#ecebea",
                          color: d.isActive ? "#fff" : "#444444",
                        }}
                      >
                        {d.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={tdRight}>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        style={dangerLink}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

// ============ LAYOUTS TAB ============

function LayoutsTab({
  entity,
  layouts,
}: {
  entity: string;
  layouts: LayoutRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/object-manager/layouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: entity,
        name: name.trim(),
        isDefault,
        layout: { sections: [] },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? `Create failed (${res.status})`);
      return;
    }
    const created = await res.json();
    router.push(`/settings/object-manager/${entity}/layouts/${created.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this layout?")) return;
    const res = await fetch(`/api/object-manager/layouts/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? `Delete failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div style={panelHeader}>
        <div style={{ fontSize: 13, color: "#54595e" }}>
          Page layouts control which fields appear, in which sections, on the
          detail page for a record of type {entity}.
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} style={primaryBtn}>
          {creating ? "Cancel" : "+ New Layout"}
        </button>
      </div>

      {creating && (
        <div style={addCard}>
          <label style={fieldLbl}>Layout name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Default ${entity} Layout`}
            style={inputStyle}
          />
          <label style={{ ...checkRow, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span>Set as default layout for {entity}</span>
          </label>
          <div style={{ textAlign: "right", marginTop: 12 }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              style={primaryBtn}
            >
              {busy ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {layouts.length === 0 ? (
        <div style={emptyCard}>
          No page layouts saved for {entity}. Click New Layout to create one.
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Default</th>
              <th style={th}>Record Type</th>
              <th style={th}>Sections</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {layouts.map((l) => (
              <tr key={l.id}>
                <td style={td}>
                  <Link
                    href={`/settings/object-manager/${entity}/layouts/${l.id}`}
                    style={nameLink}
                  >
                    {l.name}
                  </Link>
                </td>
                <td style={td}>
                  {l.isDefault ? (
                    <span
                      style={{
                        ...pill,
                        background: "#3052ff",
                        color: "#fff",
                      }}
                    >
                      Default
                    </span>
                  ) : (
                    <span style={muted}>-</span>
                  )}
                </td>
                <td style={td}>
                  {l.recordType ?? <span style={muted}>any</span>}
                </td>
                <td style={td}>{l.sectionCount}</td>
                <td style={tdRight}>
                  <Link
                    href={`/settings/object-manager/${entity}/layouts/${l.id}`}
                    style={editLink}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    style={{ ...dangerLink, marginLeft: 12 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============ STYLES ============

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  borderBottom: "1px solid #e5e7eb",
  marginBottom: 16,
};
const tabBtn: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 13,
  padding: "10px 14px",
  border: "2px solid transparent",
  borderBottomWidth: 2,
  borderTopRightRadius: 6,
  borderTopLeftRadius: 6,
  cursor: "pointer",
  background: "transparent",
};
const tableWrap: React.CSSProperties = { overflowX: "auto" };
const tableStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  borderCollapse: "separate",
  borderSpacing: 0,
  overflow: "hidden",
};
const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#54595e",
  padding: "10px 14px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  borderTop: "1px solid #f0f0f0",
  fontSize: 13,
  color: "#0a0a0a",
  fontFamily: "Manrope, system-ui, sans-serif",
  verticalAlign: "top",
};
const tdRight: React.CSSProperties = { ...td, textAlign: "right", whiteSpace: "nowrap" };
const muted: React.CSSProperties = { color: "#9ca3af" };
const fieldCode: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#f5f6f8",
  padding: "1px 6px",
  borderRadius: 4,
  color: "#0a0a0a",
};
const fieldDoc: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#6b7280",
  maxWidth: 360,
};
const defaultCode: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#f5f6f8",
  padding: "1px 6px",
  borderRadius: 4,
  color: "#444444",
};
const indexBadge: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 4,
  background: "#eaf0ff",
  color: "#3052ff",
  marginRight: 4,
};
const dotYes: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#2e844a",
};
const dotNo: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
};
const pill: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};
const editBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #c9c9c9",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#3052ff",
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const primaryBtn: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  border: "none",
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0a0a0a",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  border: "1px solid #c9c9c9",
  cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  background: "#fff",
  color: "#c23934",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  border: "1px solid #f5c6c6",
  cursor: "pointer",
};
const dangerLink: React.CSSProperties = {
  background: "transparent",
  color: "#c23934",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
const editLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};
const nameLink: React.CSSProperties = {
  color: "#0a0a0a",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};
const inlineLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontWeight: 600,
};
const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalCard: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  width: "min(560px, 100% - 32px)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const modalHeader: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const modalKicker: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#54595e",
};
const modalTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#0a0a0a",
  marginTop: 2,
};
const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #c9c9c9",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const fieldLbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#54595e",
  marginTop: 10,
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #c9c9c9",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "Manrope, system-ui, sans-serif",
};
const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#0a0a0a",
};
const errBox: React.CSSProperties = {
  marginTop: 12,
  background: "#fef2f2",
  color: "#c23934",
  border: "1px solid #f5c6c6",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
};
const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 12,
  padding: "12px 14px",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};
const addCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#0a0a0a",
  margin: "0 0 8px 4px",
};
const emptyCard: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #c9c9c9",
  borderRadius: 8,
  padding: 24,
  fontSize: 13,
  color: "#6b7280",
  textAlign: "center",
  fontFamily: "Manrope, system-ui, sans-serif",
};

function typePill(kind: FieldMeta["kind"]): React.CSSProperties {
  let bg = "#f5f6f8";
  let color = "#0a0a0a";
  if (kind === "object") {
    bg = "#eaf0ff";
    color = "#3052ff";
  } else if (kind === "enum") {
    bg = "#fef3c7";
    color = "#92400e";
  }
  return {
    display: "inline-block",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    background: bg,
    color,
  };
}
