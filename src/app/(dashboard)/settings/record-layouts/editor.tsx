"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fieldCatalog, layoutStages, defaultFieldLayout, type LayoutEntity, type RecordFieldLayout, type GridLayout } from "@/lib/record-field-layout";
export function RecordLayoutEditor({ entity, stage, initial, version: initialVersion, inherited }: { entity: LayoutEntity; stage: string; initial: RecordFieldLayout; version: string | null; inherited: boolean }) {
  const router = useRouter();
  const [layout, setLayout] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  function choose(nextEntity: string, nextStage: string) {
    if (dirty && !window.confirm("Discard your unsaved layout changes?")) return;
    router.push(`/settings/record-layouts?entity=${encodeURIComponent(nextEntity)}&stage=${encodeURIComponent(nextStage)}`);
  }
  function change(id: string, next: GridLayout) { setLayout(current => ({ ...current, [id]: next })); setDirty(true); setMessage(""); }
  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/record-field-layouts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, stage, layout, version }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      setVersion(result.version); setDirty(false); setMessage("Saved. Refresh open records to see the new layout.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setSaving(false); }
  }
  return <main className="layout-editor">
    <Link href="/settings">‹ Settings</Link>
    <h1>Fields & stage requirements</h1>
    <p>Choose field positions, visibility, and the fields required to enter each stage. Changes apply to everyone viewing this record type and stage.</p>
    <div className="toolbar">
      <label>Record type<select value={entity} disabled={saving} onChange={event => choose(event.target.value, "*")}>{Object.keys(fieldCatalog).map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Stage<select value={stage} disabled={saving} onChange={event => choose(entity, event.target.value)}><option value="*">All stages — default</option>{layoutStages[entity].map(name => <option key={name}>{name}</option>)}</select></label>
      <button disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save layout"}</button>
      <button disabled={saving} onClick={() => { if (window.confirm("Restore the original field positions and visibility? Save to apply.")) { setLayout(defaultFieldLayout(entity)); setDirty(true); setMessage(""); } }}>Restore original</button>
      {dirty && <span>Unsaved changes</span>}
    </div>
    {inherited && !version && <p>This stage uses the default layout. Saving creates an override for this stage.</p>}
    <p>Required fields are checked when a record enters this stage, including lead conversion. Existing business rules also apply. <Link href="/settings/validation-rules">Manage validation rules</Link> · <Link href="/settings/path-guidance">Manage stage guidance</Link></p>
    <p role="status" aria-live="polite">{message}</p>
    <input type="search" aria-label="Find a field or section" placeholder="Find a field or section…" value={search} onChange={event => setSearch(event.target.value)} />
    {fieldCatalog[entity].filter(group => `${group.title} ${group.fields.map(f => f.label).join(" ")}`.toLowerCase().includes(search.toLowerCase())).map(group => {
      const grid = layout[group.id];
      const complete = [...grid.fields, ...group.fields.filter(f => !grid.fields.some(saved => saved.id === f.id)).map(f => ({ id: f.id, hidden: false, required: false, span: 1 as const }))];
      return <section key={group.id}><header><h2>{group.title}</h2><label>Columns <select disabled={saving} value={grid.columns} onChange={event => change(group.id, { ...grid, columns: Number(event.target.value) as 1 | 2 })}><option value={1}>One</option><option value={2}>Two</option></select></label></header>
        <div className="field-preview" style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}>{complete.map((field, index) => <div key={field.id} className={`field-slot ${field.hidden ? "hidden-field" : ""}`} style={{ gridColumn: field.span === 2 ? "1 / -1" : undefined }}>
          <strong>{field.id}</strong><div className="controls">
          <button disabled={saving || index === 0} aria-label={`Move ${field.id} earlier`} onClick={() => { const fields = [...complete]; [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]]; change(group.id, { ...grid, fields }); }}>↑</button>
          <button disabled={saving || index === complete.length - 1} aria-label={`Move ${field.id} later`} onClick={() => { const fields = [...complete]; [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]]; change(group.id, { ...grid, fields }); }}>↓</button>
          <label><input type="checkbox" disabled={saving || field.required} checked={!field.hidden} onChange={event => change(group.id, { ...grid, fields: complete.map(f => f.id === field.id ? { ...f, hidden: !event.target.checked } : f) })} />Show</label>
          {group.fields.find(known => known.id === field.id)?.requirementKey && <label><input type="checkbox" disabled={saving} checked={field.required ?? false} onChange={event => change(group.id, { ...grid, fields: complete.map(f => f.id === field.id ? { ...f, required: event.target.checked, hidden: event.target.checked ? false : f.hidden } : f) })} />Required to enter stage</label>}
          <label><input type="checkbox" disabled={saving || grid.columns === 1} checked={field.span === 2} onChange={event => change(group.id, { ...grid, fields: complete.map(f => f.id === field.id ? { ...f, span: event.target.checked ? 2 : 1 } : f) })} />Full width</label>
          </div></div>)}</div>
      </section>;
    })}
    <style jsx>{`
      .layout-editor{max-width:1120px;margin:0 auto;padding:20px;color:#181818}.layout-editor h1{font-size:26px;font-weight:700;margin:12px 0}.layout-editor p{margin:10px 0;color:#54595e}.toolbar{display:flex;gap:14px;align-items:end;flex-wrap:wrap;position:sticky;top:0;z-index:5;background:#f3f6fb;padding:16px;border:1px solid #c9c9c9;border-radius:6px}.toolbar label{display:grid;gap:5px}select,button,input[type=search]{padding:8px;border:1px solid #b9bec7;border-radius:4px;background:white}button{cursor:pointer;color:#0176d3}button:disabled{opacity:.45;cursor:default}section{margin:18px 0;border:1px solid #c9c9c9;border-radius:6px;background:white}section header{padding:12px;display:flex;justify-content:space-between;align-items:center;background:#fafaf9}h2{font-size:16px;font-weight:700;text-transform:capitalize}.field-preview{display:grid;gap:10px;padding:12px}.field-slot{border:1px solid #d8dde6;border-radius:4px;padding:10px;min-width:0}.field-slot strong{font-size:13px}.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.controls label{font-size:12px;display:flex;gap:4px}.controls button{padding:2px 9px}.hidden-field{opacity:.55;background:#f4f4f4}input[type=search]{width:100%;max-width:420px}@media(max-width:650px){.field-preview{grid-template-columns:1fr!important}}
    `}</style>
  </main>;
}
