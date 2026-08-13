"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * SF Kanban, styled 1:1 with the org's console boards: navy chevron column
 * headers with "Name (count)", optional record-type group tabs above the
 * board, compact white cards with a per-card caret menu. Dragging a card to
 * another column PATCHes the group field (stage / status / owner).
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

export interface KanbanGroupTab {
  label: string;
  count: number;
  href: string;
  active: boolean;
}

export function KanbanBoard({
  columns,
  entity,
  fieldKey,
  groupTabs,
}: {
  columns: KanbanColumn[];
  /** API segment: "leads" | "opportunities" | "accounts" */
  entity: string;
  /** Field to PATCH on drop: "status" | "stage" | "ownerId" */
  fieldKey: string;
  /** SF record-type tabs above the board (e.g. BUSINESS ACCOUNT (24)) */
  groupTabs?: KanbanGroupTab[];
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  async function drop(colValue: string) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id || !colValue) return;
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

  // SF chevron column header (same construction as the record-page path).
  const chev = (first: boolean, last: boolean): string =>
    last
      ? "polygon(0 0, calc(100% - 1px) 0, calc(100% - 1px) 100%, 0 100%, 8px 50%)"
      : first
      ? "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)"
      : "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)";

  return (
    <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderTop: "none" }}>
      {groupTabs && groupTabs.length > 0 && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #c9c9c9", padding: "0 8px" }}>
          {groupTabs.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              style={{
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: t.active ? "#181818" : "#444444",
                borderBottom: t.active ? "3px solid #0176d3" : "3px solid transparent",
                textDecoration: "none",
                marginBottom: -1,
              }}
            >
              {t.label} ({t.count})
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, overflowX: "auto", alignItems: "flex-start", padding: "10px 8px" }}>
        {columns.map((col, i) => (
          <div
            key={col.value || col.label}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.value);
            }}
            onDragLeave={() => setOverCol((v) => (v === col.value ? null : v))}
            onDrop={() => void drop(col.value)}
            style={{ width: 200, flexShrink: 0, paddingRight: 2 }}
          >
            <div
              title={`${col.label} (${col.count})`}
              style={{
                background: overCol === col.value ? "#0b5cab" : "#16325c",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                clipPath: chev(i === 0, i === columns.length - 1),
                marginLeft: i === 0 ? 0 : -6,
                paddingLeft: i === 0 ? 8 : 14,
                paddingRight: 10,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {col.label}&nbsp;({col.count.toLocaleString("en-US")}{col.countCapped ? "+" : ""})
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "10px 6px 4px 2px",
                maxHeight: "calc(100vh - 300px)",
                overflowY: "auto",
                background: overCol === col.value ? "#f4f8fd" : "transparent",
                borderRight: "1px solid #ecebea",
                minHeight: 60,
              }}
            >
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
                    padding: "6px 8px",
                    cursor: "grab",
                    position: "relative",
                    boxShadow: dragId === card.id ? "0 4px 10px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.08)",
                    opacity: dragId === card.id ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <span style={{ color: "#c9c9c9", fontSize: 10, cursor: "grab", lineHeight: "18px" }}>⠿</span>
                    <Link
                      href={card.href}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
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
                    <button
                      onClick={() => setMenuFor((v) => (v === card.id ? null : card.id))}
                      aria-label="Card actions"
                      style={{
                        background: "#fff",
                        border: "1px solid #c9c9c9",
                        borderRadius: "50%",
                        width: 18,
                        height: 18,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#0176d3",
                        flexShrink: 0,
                        padding: 0,
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                        <path d="M0 2.5l5 5 5-5z" />
                      </svg>
                    </button>
                  </div>
                  {menuFor === card.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: 24,
                        right: 4,
                        zIndex: 30,
                        background: "#fff",
                        border: "1px solid #c9c9c9",
                        borderRadius: 4,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        minWidth: 110,
                      }}
                    >
                      <Link
                        href={card.href}
                        style={{ display: "block", padding: "6px 12px", fontSize: 12, color: "#181818", textDecoration: "none" }}
                      >
                        Open
                      </Link>
                    </div>
                  )}
                  {card.sub && (
                    <div style={{ fontSize: 11.5, color: "#444444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 14 }}>
                      {card.sub}
                    </div>
                  )}
                  {card.amount && (
                    <div style={{ fontSize: 11.5, color: "#444444", paddingLeft: 14 }}>{card.amount}</div>
                  )}
                </div>
              ))}
              {col.cards.length === 0 && (
                <div style={{ padding: 10, fontSize: 11, color: "#747474", textAlign: "center" }}>Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
