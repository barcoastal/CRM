"use client";

import { Plus, Trash2 } from "@/components/icons/lucide";

export interface CriteriaRule {
  field: string;
  operator: string;
  value: string;
}

const OPERATORS: { value: string; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "in", label: "in (comma-list)" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];

export function CriteriaBuilder({
  value,
  onChange,
}: {
  value: CriteriaRule[];
  onChange: (next: CriteriaRule[]) => void;
}) {
  function update(idx: number, patch: Partial<CriteriaRule>) {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function add() {
    onChange([...value, { field: "", operator: "equals", value: "" }]);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="text-[12px] text-[#747474] italic">No criteria. Any record will match.</div>
      )}
      {value.map((rule, idx) => {
        const valueDisabled = rule.operator === "isNull" || rule.operator === "isNotNull";
        return (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-[11px] text-[#747474] w-4">{idx + 1}</span>
            <input
              value={rule.field}
              onChange={(e) => update(idx, { field: e.target.value })}
              placeholder="field (e.g. amount, totalDebt)"
              className="flex-1 px-3 py-1.5 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff]"
            />
            <select
              value={rule.operator}
              onChange={(e) => update(idx, { operator: e.target.value })}
              className="px-2 py-1.5 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff] bg-white"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              value={rule.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              placeholder="value"
              disabled={valueDisabled}
              className="flex-1 px-3 py-1.5 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff] disabled:bg-[#f3f2f2]"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="p-1.5 text-[#9d1414] hover:bg-[#fde2e2] rounded"
              title="Remove"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
      >
        <Plus className="size-3" />
        Add criterion
      </button>
    </div>
  );
}
