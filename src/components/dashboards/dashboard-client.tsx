"use client";

import { useRouter } from "next/navigation";
import type { RuntimeFilters } from "@/lib/reports/runtime-filters";
import { useEffect, useState } from "react";
import { Pencil, Eye, Plus, Trash2 } from "@/components/icons/lucide";
import { DashboardGrid } from "./dashboard-grid";

export interface DashboardTileData {
  id: string;
  kind: string;
  title: string;
  queryKey: string | null;
  reportId: string | null;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  isShared: boolean;
  createdBy: { id: string; name: string } | null;
  tiles: DashboardTileData[];
}

export function DashboardClient({ initial, canEdit = false }: { initial: DashboardData; canEdit?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initial);
  const [filters, setFilters] = useState<RuntimeFilters>({});
  const [draftFilters, setDraftFilters] = useState<RuntimeFilters>({});
  const [owners, setOwners] = useState<{id:string;name:string}[]>([]);
  useEffect(() => { fetch("/api/analytics/owners").then(r => r.ok ? r.json() : {items:[]}).then(r => setOwners(r.items ?? [])).catch(() => setOwners([])); }, []);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  async function addTile() {
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboards/${data.id}/tiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "kpi",
          title: "New Tile",
          queryKey: "leads.total_open",
        }),
      });
      if (res.ok) {
        const tile = await res.json();
        setData((d) => ({
          ...d,
          tiles: [
            ...d.tiles,
            {
              id: tile.id,
              kind: tile.kind,
              title: tile.title,
              queryKey: tile.queryKey,
              reportId: tile.reportId,
              config: (tile.config ?? {}) as Record<string, unknown>,
              position: tile.position ?? { x: 0, y: 0, w: 3, h: 2 },
            },
          ],
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateTile(tileId: string, patch: Partial<DashboardTileData>) {
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${data.id}/tiles/${tileId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Could not save tile. Please try again.");
      setData(d => ({ ...d, tiles: d.tiles.map(t => t.id === tileId ? { ...t, ...patch } : t) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save tile."); }
  }

  async function deleteTile(tileId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/dashboards/${data.id}/tiles/${tileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete tile. Please try again.");
      setData(d => ({ ...d, tiles: d.tiles.filter(t => t.id !== tileId) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete tile."); }
  }

  async function deleteDashboard() {
    if (!confirm("Delete this dashboard? Tiles will be removed too.")) return;
    setBusy(true);
    const res = await fetch(`/api/dashboards/${data.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboards");
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {data.name}
          </h1>
          {data.description && (
            <p className="text-[13px] text-[#444656] mt-1">{data.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#747474]">
            <span>
              {data.isShared ? "Shared" : "Private"}
            </span>
            {data.createdBy && <span>Owner: {data.createdBy.name}</span>}
            <span>{data.tiles.length} tile{data.tiles.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="slds-button slds-button_neutral" onClick={() => setRefreshVersion(v => v + 1)}>Refresh</button>
          {canEdit && editing && (
            <button
              type="button"
              onClick={deleteDashboard}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[#942b00] text-[13px] font-semibold border border-[#f4d5cc] bg-white disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          )}
          {canEdit && <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold border border-[#c9c9c9] bg-white text-[#131b2e]"
          >
            {editing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
            {editing ? "Done" : "Edit"}
          </button>}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <section className="bg-white border rounded p-3 flex flex-wrap items-end gap-3 text-xs" aria-label="Dashboard filters">
        <label>From (created/snapshot date)<input aria-label="Dashboard from date" type="date" className="block border rounded p-1" value={draftFilters.from ?? ""} onChange={e => setDraftFilters(f => ({...f, from:e.target.value || undefined}))}/></label>
        <label>Through<input aria-label="Dashboard through date" type="date" className="block border rounded p-1" value={draftFilters.to ?? ""} onChange={e => setDraftFilters(f => ({...f, to:e.target.value || undefined}))}/></label>
        <label>Owner<select aria-label="Dashboard owner" className="block border rounded p-1" value={draftFilters.ownerId ?? ""} onChange={e => setDraftFilters(f => ({...f, ownerId:e.target.value || undefined}))}><option value="">All accessible owners</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label><input type="checkbox" checked={draftFilters.includeTeam ?? false} onChange={e => setDraftFilters(f => ({...f,includeTeam:e.target.checked}))}/> Include selected owner’s team</label>
        <button className="slds-button slds-button_brand" onClick={() => setFilters({...draftFilters})}>Apply to all tiles</button>
        <button className="slds-button slds-button_neutral" onClick={() => {setDraftFilters({});setFilters({});}}>Reset</button>
      </section>
      <DashboardGrid
        key={refreshVersion}
        runtimeFilters={filters}
        tiles={data.tiles}
        editing={canEdit && editing}
        onUpdate={updateTile}
        onDelete={deleteTile}
      />

      {canEdit && editing && (
        <button
          type="button"
          onClick={addTile}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          Add Tile
        </button>
      )}
    </div>
  );
}
