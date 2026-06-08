"use client";

import type { DashboardTileData } from "./dashboard-client";
import { DashboardTile } from "./dashboard-tile";

interface Props {
  tiles: DashboardTileData[];
  editing: boolean;
  onUpdate: (tileId: string, patch: Partial<DashboardTileData>) => Promise<void>;
  onDelete: (tileId: string) => Promise<void>;
}

export function DashboardGrid({ tiles, editing, onUpdate, onDelete }: Props) {
  if (tiles.length === 0) {
    return (
      <section
        className="bg-white rounded-xl px-10 py-14 text-center"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <h2 className="text-[15px] font-bold text-[#131b2e]">No tiles yet</h2>
        <p className="text-[13px] text-[#444656] mt-1">
          {editing ? "Click Add Tile below to get started." : "Click Edit, then Add Tile to start."}
        </p>
      </section>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gridAutoRows: "minmax(80px, auto)",
        gridAutoFlow: "row",
      }}
    >
      {tiles.map((tile) => {
        const w = Math.max(1, Math.min(12, tile.position?.w ?? 3));
        const h = Math.max(1, Math.min(8, tile.position?.h ?? 2));
        return (
          <div
            key={tile.id}
            style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }}
          >
            <DashboardTile
              tile={tile}
              editing={editing}
              onUpdate={(patch) => onUpdate(tile.id, patch)}
              onDelete={() => onDelete(tile.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
