"use client";

import type { ConditionGroup, ConditionLeaf, ConditionOperator } from "@/lib/flow/nodes";

const OPS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "not equal" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];

/** Edits a flat ConditionGroup (AND/OR over leaf conditions). Nested groups are left as-is. */
export function ConditionBuilder({ value, onChange }: { value: ConditionGroup; onChange: (g: ConditionGroup) => void }) {
  const leaves = value.conditions.filter((c): c is ConditionLeaf => "field" in c);
  function setLeaf(i: number, patch: Partial<ConditionLeaf>) {
    const next = leaves.map((l, j) => (j === i ? { ...l, ...patch } : l));
    onChange({ ...value, conditions: next });
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span className="ec-field-label" style={{ margin: 0 }}>Match</span>
        <select
          className="ec-select ec-select-sm"
          style={{ width: 90 }}
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as "and" | "or" })}
        >
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
      </div>
      {leaves.map((leaf, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            className="ec-input"
            style={{ width: 110 }}
            placeholder="field"
            value={leaf.field}
            onChange={(e) => setLeaf(i, { field: e.target.value })}
          />
          <select
            className="ec-select"
            style={{ width: 120 }}
            value={leaf.operator}
            onChange={(e) => setLeaf(i, { operator: e.target.value as ConditionOperator })}
          >
            {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {leaf.operator !== "isNull" && leaf.operator !== "isNotNull" ? (
            <input
              className="ec-input"
              style={{ flex: 1 }}
              placeholder="value"
              value={String(leaf.value ?? "")}
              onChange={(e) => setLeaf(i, { value: e.target.value })}
            />
          ) : <span style={{ flex: 1 }} />}
          <button
            className="ec-btn ec-btn-ghost"
            onClick={() => onChange({ ...value, conditions: leaves.filter((_, j) => j !== i) })}
          >
            x
          </button>
        </div>
      ))}
      <button
        className="ec-btn ec-btn-ghost"
        style={{ marginTop: 4 }}
        onClick={() => onChange({ ...value, conditions: [...leaves, { field: "status", operator: "equals", value: "" }] })}
      >
        + Add condition
      </button>
    </div>
  );
}
