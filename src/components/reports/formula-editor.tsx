"use client";
import type { ReportFormula } from "@/lib/reports/formulas";
import type { ObjectField } from "@/lib/reports/object-metadata";

export function FormulaEditor({ formulas, fields, onChange }: { formulas: ReportFormula[]; fields: ObjectField[]; onChange: (value: ReportFormula[]) => void }) {
  const numeric = fields.filter(f => f.type === "number" && f.source !== "computed");
  const patch = (index: number, value: Partial<ReportFormula>) => onChange(formulas.map((f, i) => i === index ? { ...f, ...value } : f));
  const operand = (formula: ReportFormula, index: number, side: "left" | "right") => <div className="flex gap-1">
    <select aria-label={`${side} operand`} className="border rounded p-1 min-w-0 w-full" value={typeof formula[side] === "number" ? "constant" : formula[side]} onChange={e => patch(index, { [side]: e.target.value === "constant" ? 1 : e.target.value })}>
      <option value="constant">Number</option>{numeric.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
    </select>
    {typeof formula[side] === "number" && <input aria-label={`${side} number`} type="number" step="any" className="border rounded p-1 w-20" value={formula[side]} onChange={e => patch(index, { [side]: Number(e.target.value) })} />}
  </div>;
  return <section className="bg-white rounded-xl p-4 text-xs space-y-3">
    <div className="flex justify-between"><h2 className="font-bold">Formula columns</h2><button disabled={formulas.length >= 10} onClick={() => onChange([...formulas, { key: `formula_${crypto.randomUUID().replaceAll("-", "")}`, label: "New formula", left: numeric[0]?.key ?? 0, operator: "subtract", right: numeric[1]?.key ?? 0 }])} className="text-blue-700 disabled:opacity-50">+ Add formula</button></div>
    <p className="text-gray-600">Calculate values for each row. Percentage = left ÷ right × 100. Missing values and division by zero produce a blank.</p>
    {formulas.map((f, i) => <div key={f.key} className="border rounded p-2 space-y-2">
      <div className="flex gap-2"><input aria-label="Formula name" className="border rounded p-1 flex-1 min-w-0" maxLength={80} value={f.label} onChange={e => patch(i, { label: e.target.value })} /><button aria-label={`Remove ${f.label}`} onClick={() => onChange(formulas.filter((_, j) => j !== i))}>Remove</button></div>
      {operand(f, i, "left")}
      <select aria-label="Formula operation" className="border rounded p-1 w-full" value={f.operator} onChange={e => patch(i, { operator: e.target.value as ReportFormula["operator"] })}>
        <option value="add">Add +</option><option value="subtract">Subtract −</option><option value="multiply">Multiply ×</option><option value="divide">Divide ÷</option><option value="percent">Percentage %</option>
      </select>
      {operand(f, i, "right")}
    </div>)}
  </section>;
}
