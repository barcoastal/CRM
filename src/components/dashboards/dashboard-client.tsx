"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function DashboardClient({ initial }: { initial: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setData((d) => ({
      ...d,
      tiles: d.tiles.map((t) => (t.id === tileId ? { ...t, ...patch } : t)),
    }));
    await fetch(`/api/dashboards/${data.id}/tiles/${tileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteTile(tileId: string) {
    setData((d) => ({ ...d, tiles: d.tiles.filter((t) => t.id !== tileId) }));
    await fetch(`/api/dashboards/${data.id}/tiles/${tileId}`, { method: "DELETE" });
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
          {editing && (
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
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold border border-[#c9c9c9] bg-white text-[#131b2e]"
          >
            {editing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      <DashboardGrid
        tiles={data.tiles}
        editing={editing}
        onUpdate={updateTile}
        onDelete={deleteTile}
      />

      {editing && (
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
