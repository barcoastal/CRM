"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FieldLite = {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isList: boolean;
  isRequired: boolean;
};

type Slot = { fieldName: string; span: 1 | 2 };
type Section = { name: string; columns: 1 | 2; fields: Slot[] };
type LayoutJson = { sections: Section[] };

function normalize(value: unknown, known: Set<string>): LayoutJson {
  if (!value || typeof value !== "object") return { sections: [] };
  const sectionsRaw = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sectionsRaw)) return { sections: [] };
  const out: Section[] = [];
  for (const s of sectionsRaw) {
    if (!s || typeof s !== "object") continue;
    const sec = s as { name?: unknown; columns?: unknown; fields?: unknown };
    const name = typeof sec.name === "string" ? sec.name : "Section";
    const cols: 1 | 2 = sec.columns === 2 ? 2 : 1;
    const fields: Slot[] = [];
    if (Array.isArray(sec.fields)) {
      for (const f of sec.fields) {
        if (!f || typeof f !== "object") continue;
        const fo = f as { fieldName?: unknown; span?: unknown };
        const fn = typeof fo.fieldName === "string" ? fo.fieldName : "";
        if (!fn || !known.has(fn)) continue;
        const span: 1 | 2 = fo.span === 2 ? 2 : 1;
        fields.push({ fieldName: fn, span });
      }
    }
    out.push({ name, columns: cols, fields });
  }
  return { sections: out };
}

export function LayoutEditor({
  layoutId,
  entity,
  initialName,
  initialIsDefault,
  initialRecordType,
  initialLayout,
  fields,
}: {
  layoutId: string;
  entity: string;
  initialName: string;
  initialIsDefault: boolean;
  initialRecordType: string | null;
  initialLayout: unknown;
  fields: FieldLite[];
}) {
  const router = useRouter();
  const knownNames = useMemo(() => new Set(fields.map((f) => f.name)), [fields]);
  const initial = useMemo(() => normalize(initialLayout, knownNames), [initialLayout, knownNames]);

  const [name, setName] = useState(initialName);
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [recordType, setRecordType] = useState(initialRecordType ?? "");
  const [sections, setSections] = useState<Section[]>(
    initial.sections.length
      ? initial.sections
      : [{ name: "Information", columns: 2, fields: [] }],
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const usedFields = useMemo(() => {
    const s = new Set<string>();
    for (const sec of sections) for (const f of sec.fields) s.add(f.fieldName);
    return s;
  }, [sections]);

  const availableFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fields
      .filter((f) => f.kind !== "object" || true) // include relations too
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fields, search]);

  function addSection() {
    setSections((s) => [...s, { name: `Section ${s.length + 1}`, columns: 2, fields: [] }]);
  }

  function removeSection(idx: number) {
    setSections((s) => s.filter((_, i) => i !== idx));
  }

  function updateSection(idx: number, patch: Partial<Section>) {
    setSections((s) => s.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)));
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setSections((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      const [item] = next.splice(idx, 1);
      next.splice(j, 0, item);
      return next;
    });
  }

  function addFieldToSection(sectionIdx: number, fieldName: string) {
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIdx && !sec.fields.some((f) => f.fieldName === fieldName)
          ? { ...sec, fields: [...sec.fields, { fieldName, span: 1 }] }
          : sec,
      ),
    );
  }

  function removeFieldFromSection(sectionIdx: number, fieldName: string) {
    setSections((s) =>
      s.map((sec, i) =>
        i === sectionIdx
          ? { ...sec, fields: sec.fields.filter((f) => f.fieldName !== fieldName) }
          : sec,
      ),
    );
  }

  function moveField(sectionIdx: number, fieldName: string, dir: -1 | 1) {
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sectionIdx) return sec;
        const idx = sec.fields.findIndex((f) => f.fieldName === fieldName);
        if (idx < 0) return sec;
        const j = idx + dir;
        if (j < 0 || j >= sec.fields.length) return sec;
        const next = [...sec.fields];
        const [item] = next.splice(idx, 1);
        next.splice(j, 0, item);
        return { ...sec, fields: next };
      }),
    );
  }

  function toggleSpan(sectionIdx: number, fieldName: string) {
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sectionIdx) return sec;
        return {
          ...sec,
          fields: sec.fields.map((f) =>
            f.fieldName === fieldName ? { ...f, span: f.span === 2 ? 1 : 2 } : f,
          ),
        };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    const res = await fetch(`/api/object-manager/layouts/${layoutId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        isDefault,
        recordType: recordType.trim() || null,
        layout: { sections },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? `Save failed (${res.status})`);
      return;
    }
    setSavedMsg("Saved");
    router.refresh();
    setTimeout(() => setSavedMsg(null), 2000);
  }

  // Drag-drop. Keep it simple: drag handle on each available field, drop on a
  // section drop zone. No reordering via drag, only via up/down arrows.
  const [dragField, setDragField] = useState<string | null>(null);

  return (
    <div>
      <header style={headerCard}>
        <div style={{ flex: 1 }}>
          <label style={fieldLbl}>Layout name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }}
          />
        </div>
        <div style={{ width: 180 }}>
          <label style={fieldLbl}>Record type filter</label>
          <input
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            placeholder="any"
            style={inputStyle}
          />
        </div>
        <label style={{ ...checkRow, alignSelf: "end", marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <span>Default for {entity}</span>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={handleSave}
            style={primaryBtn}
          >
            {saving ? "Saving..." : "Save Layout"}
          </button>
          {savedMsg && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#2e844a" }}>
              {savedMsg}
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        {/* LEFT RAIL */}
        <aside style={railCard}>
          <div style={railHeader}>Fields</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={railList}>
            {availableFields.map((f) => {
              const used = usedFields.has(f.name);
              return (
                <div
                  key={f.name}
                  draggable={!used}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", f.name);
                    e.dataTransfer.effectAllowed = "copy";
                    setDragField(f.name);
                  }}
                  onDragEnd={() => setDragField(null)}
                  style={{
                    ...railItem,
                    opacity: used ? 0.4 : 1,
                    cursor: used ? "default" : "grab",
                    background: dragField === f.name ? "#eaf0ff" : "#fff",
                  }}
                  title={used ? "Already on layout" : "Drag onto a section"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</span>
                    <span style={railTypeBadge}>{f.type}{f.isList ? "[]" : ""}</span>
                  </div>
                </div>
              );
            })}
            {availableFields.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: 8 }}>
                No matches.
              </div>
            )}
          </div>
        </aside>

        {/* CENTER */}
        <div>
          {sections.map((sec, i) => (
            <SectionEditor
              key={i}
              index={i}
              section={sec}
              total={sections.length}
              onRename={(v) => updateSection(i, { name: v })}
              onColumns={(c) => updateSection(i, { columns: c })}
              onMoveUp={() => moveSection(i, -1)}
              onMoveDown={() => moveSection(i, 1)}
              onRemove={() => removeSection(i)}
              onDropField={(fn) => {
                if (knownNames.has(fn)) addFieldToSection(i, fn);
                setDragField(null);
              }}
              onRemoveField={(fn) => removeFieldFromSection(i, fn)}
              onMoveField={(fn, d) => moveField(i, fn, d)}
              onToggleSpan={(fn) => toggleSpan(i, fn)}
            />
          ))}

          <button type="button" onClick={addSection} style={addSectionBtn}>
            + Add Section
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({
  index,
  section,
  total,
  onRename,
  onColumns,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDropField,
  onRemoveField,
  onMoveField,
  onToggleSpan,
}: {
  index: number;
  section: Section;
  total: number;
  onRename: (v: string) => void;
  onColumns: (c: 1 | 2) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDropField: (fn: string) => void;
  onRemoveField: (fn: string) => void;
  onMoveField: (fn: string, d: -1 | 1) => void;
  onToggleSpan: (fn: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <section style={sectionCard}>
      <header style={sectionHeader}>
        <input
          value={section.name}
          onChange={(e) => onRename(e.target.value)}
          style={{ ...inputStyle, fontSize: 13, fontWeight: 700, flex: 1, marginRight: 12 }}
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#54595e" }}>Cols:</span>
          <button
            type="button"
            onClick={() => onColumns(1)}
            style={section.columns === 1 ? toggleBtnActive : toggleBtn}
          >
            1
          </button>
          <button
            type="button"
            onClick={() => onColumns(2)}
            style={section.columns === 2 ? toggleBtnActive : toggleBtn}
          >
            2
          </button>
          <span style={{ width: 8 }} />
          <button type="button" onClick={onMoveUp} disabled={index === 0} style={iconBtn}>
            Up
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={iconBtn}
          >
            Down
          </button>
          <button type="button" onClick={onRemove} style={dangerSmallBtn}>
            Remove
          </button>
        </div>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const fn = e.dataTransfer.getData("text/plain");
          if (fn) onDropField(fn);
        }}
        style={{
          ...dropZone,
          background: over ? "#eaf0ff" : "#fafbfc",
          borderColor: over ? "#3052ff" : "#e5e7eb",
        }}
      >
        {section.fields.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 14 }}>
            Drag fields from the left rail, or use Add via the rail buttons.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                section.columns === 2 ? "1fr 1fr" : "1fr",
              gap: 8,
            }}
          >
            {section.fields.map((slot, idx) => (
              <div
                key={slot.fieldName}
                style={{
                  ...fieldChip,
                  gridColumn:
                    section.columns === 2 && slot.span === 2 ? "span 2" : "auto",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {slot.fieldName}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {section.columns === 2 && (
                    <button
                      type="button"
                      onClick={() => onToggleSpan(slot.fieldName)}
                      style={iconBtn}
                      title="Toggle span"
                    >
                      {slot.span === 2 ? "1/2" : "2/2"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onMoveField(slot.fieldName, -1)}
                    disabled={idx === 0}
                    style={iconBtn}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveField(slot.fieldName, 1)}
                    disabled={idx === section.fields.length - 1}
                    style={iconBtn}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveField(slot.fieldName)}
                    style={dangerSmallBtn}
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ============ STYLES ============

const headerCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  display: "flex",
  gap: 16,
  alignItems: "flex-end",
};
const railCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  height: "fit-content",
  position: "sticky",
  top: 16,
};
const railHeader: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#54595e",
  marginBottom: 8,
};
const railList: React.CSSProperties = {
  maxHeight: "60vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const railItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "6px 8px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};
const railTypeBadge: React.CSSProperties = {
  fontSize: 10,
  color: "#54595e",
  background: "#f5f6f8",
  padding: "0 5px",
  borderRadius: 3,
};
const sectionCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};
const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 10,
};
const dropZone: React.CSSProperties = {
  border: "1px dashed",
  borderRadius: 6,
  padding: 10,
  minHeight: 60,
};
const fieldChip: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 6,
  padding: "8px 10px",
  fontFamily: "Manrope, system-ui, sans-serif",
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const addSectionBtn: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px dashed #3052ff",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 13,
  color: "#3052ff",
  fontWeight: 700,
  fontFamily: "Manrope, system-ui, sans-serif",
  cursor: "pointer",
};
const fieldLbl: React.CSSProperties = {
  display: "block",
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#54595e",
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d8dde6",
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
const iconBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: "2px 6px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const toggleBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};
const toggleBtnActive: React.CSSProperties = {
  ...toggleBtn,
  background: "#3052ff",
  color: "#fff",
  borderColor: "#3052ff",
};
const dangerSmallBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #f5c6c6",
  borderRadius: 4,
  padding: "2px 6px",
  fontSize: 11,
  color: "#c23934",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
