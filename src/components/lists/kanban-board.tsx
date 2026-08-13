"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * SF-style Kanban for list pages: cards grouped by status/stage columns.
 * Drag a card to another column to change its status (PATCHes the same
 * field endpoint the inline editors use).
 */

export interface KanbanCard {
  id: string;
  title: string;
  sub: string | null;
  amount: string | null;
  href: string;
}

export interface KanbanColumn {
  value: string;
  label: string;
  count: number;
  countCapped?: boolean;
  cards: KanbanCard[];
}

export function KanbanBoard({
  columns,
  entity,
  fieldKey,
}: {
  columns: KanbanColumn[];
  /** API segment: "leads" | "opportunities" */
  entity: string;
  /** Field to PATCH on drop: "status" | "stage" */
  fieldKey: string;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function drop(colValue: string) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const from = columns.find((c) => c.cards.some((k) => k.id === id));
    if (from?.value === colValue) return;
    const res = await fetch(`/api/${entity}/${id}/field`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldKey]: colValue }),
    });
    if (res.ok) {
      toast.success("Moved");
      router.refresh();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(d.error ?? "Could not move the record");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        alignItems: "flex-start",
        padding: "12px",
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderTop: "none",
      }}
    >
      {columns.map((col) => (
        <div
          key={col.value}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(col.value);
          }}
          onDragLeave={() => setOverCol((v) => (v === col.value ? null : v))}
          onDrop={() => void drop(col.value)}
          style={{
            width: 250,
            flexShrink: 0,
            background: overCol === col.value ? "#eef4fb" : "#f3f3f3",
            border: "1px solid #e5e5e5",
            borderRadius: 6,
            maxHeight: "calc(100vh - 260px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #e5e5e5",
              fontSize: 12,
              fontWeight: 700,
              color: "#181818",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>
            <span style={{ color: "#747474", fontWeight: 400 }}>
              {col.count.toLocaleString("en-US")}
              {col.countCapped ? "+" : ""}
            </span>
          </header>
          <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={() => setDragId(card.id)}
                onDragEnd={() => setDragId(null)}
                style={{
                  background: "#fff",
                  border: "1px solid #dddbda",
                  borderRadius: 4,
                  padding: "8px 10px",
                  cursor: "grab",
                  boxShadow: dragId === card.id ? "0 4px 10px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.06)",
                  opacity: dragId === card.id ? 0.6 : 1,
                }}
              >
                <Link
                  href={card.href}
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0176d3",
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {card.title}
                </Link>
                {card.sub && (
                  <div style={{ fontSize: 12, color: "#444444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.sub}
                  </div>
                )}
                {card.amount && <div style={{ fontSize: 12, fontWeight: 600, color: "#181818", marginTop: 2 }}>{card.amount}</div>}
              </div>
            ))}
            {col.cards.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: "#747474", textAlign: "center" }}>Empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
