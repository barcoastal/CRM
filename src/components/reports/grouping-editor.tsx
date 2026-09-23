"use client";
import type { ObjectField } from "@/lib/reports/object-metadata";
import type { ReportGrouping } from "@/lib/reports/advanced";
export function GroupingEditor({ fields, groups, onChange }: { fields: ObjectField[]; groups: ReportGrouping[]; onChange: (groups: ReportGrouping[]) => void }) {
  return <section className="bg-white rounded-xl p-4 space-y-2 text-xs"><h2 className="font-bold">Grouping levels</h2><p>Group from left to right, such as owner → stage → month. These levels override the single Group By setting.</p>
    <div className="flex flex-wrap gap-3">{groups.map((group, index) => <div key={index} className="flex gap-1 items-center"><span>{index + 1}.</span><select aria-label={`Grouping level ${index+1}`} className="border p-1 rounded" value={group.field} onChange={e => onChange(groups.map((g,i) => i === index ? { field: e.target.value, interval: "value" } : g))}>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      {fields.find(f => f.key === group.field)?.type === "date" && <select aria-label={`Date interval ${index+1}`} className="border p-1" value={group.interval} onChange={e => onChange(groups.map((g,i) => i === index ? { ...g, interval: e.target.value as ReportGrouping["interval"] } : g))}>{["value","day","month","quarter","year"].map(v => <option key={v}>{v}</option>)}</select>}
      <button aria-label={`Remove grouping ${index+1}`} onClick={() => onChange(groups.filter((_,i) => i !== index))}>×</button></div>)}
      <button className="text-blue-700 disabled:opacity-50" disabled={groups.length >= 3} onClick={() => onChange([...groups, { field: fields[0].key, interval: "value" }])}>+ Add level</button></div>
  </section>;
}
