"use client";

/**
 * Segments tab: list of saved audience segments + inline builder.
 * Filters use the ListFilter { field, op, value } shape shared with list
 * views; the count preview hits /api/email-center/segments/count.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Filter {
  field: string;
  op: string;
  value?: unknown;
}

interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  entity: string;
  filters: Filter[];
  createdByName: string | null;
  updatedAt: string;
}

const FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  Lead: [
    { key: "status", label: "Status" },
    { key: "source", label: "Source" },
    { key: "recordType", label: "Record Type" },
    { key: "state", label: "State" },
    { key: "assignedToId", label: "Owner Id" },
    { key: "totalDebtEst", label: "Est. Total Debt" },
  ],
  Contact: [
    { key: "isActive", label: "Active" },
    { key: "ownerId", label: "Owner Id" },
    { key: "mailingState", label: "Mailing State" },
  ],
};

const OPS = [
  { key: "EQ", label: "equals" },
  { key: "NEQ", label: "not equal" },
  { key: "CONTAINS", label: "contains" },
  { key: "IN", label: "is any of (comma list)" },
  { key: "GT", label: "greater than" },
  { key: "LT", label: "less than" },
  { key: "IS_NULL", label: "is empty" },
  { key: "IS_NOT_NULL", label: "is not empty" },
];

function coerceValue(op: string, raw: string): unknown {
  if (op === "IS_NULL" || op === "IS_NOT_NULL") return undefined;
  if (op === "IN") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && !Number.isNaN(Number(raw)) && op !== "CONTAINS") return Number(raw);
  return raw;
}

function displayValue(f: Filter): string {
  if (Array.isArray(f.value)) return (f.value as unknown[]).join(", ");
  return f.value === undefined || f.value === null ? "" : String(f.value);
}

export function SegmentsClient({ initial }: { initial: SegmentRow[] }) {
  const [segments, setSegments] = useState(initial);
  const [editing, setEditing] = useState<SegmentRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback((entity: string, filters: Filter[]) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(async () => {
      const res = await fetch("/api/email-center/segments/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, filters }),
      });
      const data = await res.json().catch(() => ({}));
      setCount(typeof data.count === "number" ? data.count : null);
    }, 350);
  }, []);

  function openNew() {
    const seg: SegmentRow = {
      id: "", name: "", description: null, entity: "Lead", filters: [],
      createdByName: null, updatedAt: new Date().toISOString(),
    };
    setEditing(seg);
    setIsNew(true);
    setCount(null);
    refreshCount(seg.entity, seg.filters);
  }

  function patchEditing(patch: Partial<SegmentRow>) {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      refreshCount(next.entity, next.filters);
      return next;
    });
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: editing.name,
      description: editing.description,
      entity: editing.entity,
      filters: editing.filters,
    };
    const res = await fetch(
      isNew ? "/api/email-center/segments" : `/api/email-center/segments/${editing.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    const row: SegmentRow = {
      id: data.id, name: data.name, description: data.description, entity: data.entity,
      filters: (data.filters as Filter[]) ?? [], createdByName: editing.createdByName,
      updatedAt: new Date().toISOString(),
    };
    setSegments((prev) => (isNew ? [row, ...prev] : prev.map((s) => (s.id === row.id ? row : s))));
    setEditing(null);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/email-center/segments/${id}`, { method: "DELETE" });
    if (res.ok) setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => () => { if (countTimer.current) clearTimeout(countTimer.current); }, []);

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Segments</h1>
          <p className="ec-flows-sub">Saved audiences for campaigns. Filters update live as data changes.</p>
        </div>
        <button className="ec-btn ec-btn-primary" onClick={openNew}>New Segment</button>
      </div>

      {editing ? (
        <div className="ec-seg-editor">
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="ec-field-label">Name</label>
              <input className="ec-input" value={editing.name} placeholder="High-debt web leads"
                onChange={(e) => patchEditing({ name: e.target.value })} />
            </div>
            <div style={{ width: 140 }}>
              <label className="ec-field-label">Entity</label>
              <select className="ec-select" value={editing.entity}
                onChange={(e) => patchEditing({ entity: e.target.value, filters: [] })}>
                <option value="Lead">Leads</option>
                <option value="Contact">Contacts</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="ec-field-label">Conditions (all must match)</label>
            {editing.filters.map((f, i) => (
              <div key={i} className="ec-seg-filter-row">
                <select className="ec-select" style={{ width: 170 }} value={f.field}
                  onChange={(e) => {
                    const filters = [...editing.filters];
                    filters[i] = { ...filters[i], field: e.target.value };
                    patchEditing({ filters });
                  }}>
                  {(FIELDS[editing.entity] ?? []).map((fl) => (
                    <option key={fl.key} value={fl.key}>{fl.label}</option>
                  ))}
                </select>
                <select className="ec-select" style={{ width: 180 }} value={f.op}
                  onChange={(e) => {
                    const filters = [...editing.filters];
                    filters[i] = { ...filters[i], op: e.target.value, value: undefined };
                    patchEditing({ filters });
                  }}>
                  {OPS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {f.op !== "IS_NULL" && f.op !== "IS_NOT_NULL" ? (
                  <input className="ec-input" style={{ flex: 1 }} value={displayValue(f)} placeholder="Value"
                    onChange={(e) => {
                      const filters = [...editing.filters];
                      filters[i] = { ...filters[i], value: coerceValue(f.op, e.target.value) };
                      patchEditing({ filters });
                    }} />
                ) : <span style={{ flex: 1 }} />}
                <button className="ec-btn ec-btn-ghost" onClick={() => {
                  patchEditing({ filters: editing.filters.filter((_, j) => j !== i) });
                }}>Remove</button>
              </div>
            ))}
            <button className="ec-btn ec-btn-ghost" style={{ marginTop: 6 }} onClick={() => {
              const first = (FIELDS[editing.entity] ?? [])[0]?.key ?? "status";
              patchEditing({ filters: [...editing.filters, { field: first, op: "EQ", value: "" }] });
            }}>
              + Add condition
            </button>
          </div>
          {error ? <div className="ec-error" style={{ marginTop: 10 }}>{error}</div> : null}
          <div className="ec-seg-editor-foot">
            <span className="ec-pill ec-pill-green">
              {count === null ? "Counting..." : `${count.toLocaleString()} matching with email`}
            </span>
            <span style={{ flex: 1 }} />
            <button className="ec-btn ec-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="ec-btn ec-btn-primary" disabled={saving || !editing.name.trim()} onClick={() => void save()}>
              {saving ? "Saving..." : "Save Segment"}
            </button>
          </div>
        </div>
      ) : null}

      {segments.length === 0 && !editing ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No segments yet</div>
          <div className="ec-empty-sub">Segments are saved audience filters you can reuse across campaigns.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {segments.map((s) => (
            <div key={s.id} className="ec-flow-row">
              <button className="ec-flow-main" style={{ background: "none", border: 0, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}
                onClick={() => { setEditing(s); setIsNew(false); setCount(null); refreshCount(s.entity, s.filters); }}>
                <span className="ec-flow-name">{s.name}</span>
                {s.description ? <span className="ec-flow-desc">{s.description}</span> : null}
              </button>
              <span className="ec-pill ec-pill-neutral">{s.entity}</span>
              <span className="ec-pill ec-pill-neutral">
                {s.filters.length} condition{s.filters.length === 1 ? "" : "s"}
              </span>
              <button className="ec-btn ec-btn-ghost" onClick={() => void remove(s.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
