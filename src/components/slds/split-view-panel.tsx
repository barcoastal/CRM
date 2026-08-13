"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * SF console split view: a collapsible record list docked left of an open
 * record. Mirrors the SF panel chrome: view header with pin + display
 * selector, item count + refreshed time, search box, sortable list header,
 * checkbox rows. Console mode only (RecordPage decides when to render it).
 */

interface SplitRow {
  id: string;
  title: string;
  sub: string | null;
  meta: string | null;
  href: string;
}

const ENTITY_TO_PARAM: Record<string, string> = {
  Lead: "leads",
  Opportunity: "opportunities",
  Account: "accounts",
  Contact: "contacts",
  Case: "cases",
};

const COLLAPSE_KEY = "sf:splitView.v1"; // "open" | "closed"

export function SplitViewPanel({ entity }: { entity: string }) {
  const pathname = usePathname();
  const param = ENTITY_TO_PARAM[entity];
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [q, setQ] = useState("");
  const [sortDir, setSortDir] = useState<"recent" | "asc" | "desc">("recent");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const consoleMode = window.localStorage.getItem("sf:navMode.v1") !== "standard";
    if (!consoleMode || !param) return;
    setReady(true);
    setOpen(window.localStorage.getItem(COLLAPSE_KEY) !== "closed");
    setPinned(window.localStorage.getItem(`${COLLAPSE_KEY}:pin`) === "1");
  }, [param]);

  const load = () => {
    if (!param) return;
    fetch(`/api/split-list?entity=${param}`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows?: SplitRow[] }) => {
        setRows(d.rows ?? []);
        setRefreshedAt(new Date());
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!ready || !open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, open, param]);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    let list = rows;
    if (n) {
      list = rows.filter((r2) =>
        `${r2.title} ${r2.sub ?? ""} ${r2.meta ?? ""}`.toLowerCase().includes(n),
      );
    }
    if (sortDir === "asc") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sortDir === "desc") list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    return list;
  }, [rows, q, sortDir]);

  if (!ready || !param) return null;

  const toggle = () => {
    setOpen((v) => {
      window.localStorage.setItem(COLLAPSE_KEY, v ? "closed" : "open");
      return !v;
    });
  };

  const togglePin = () => {
    setPinned((v) => {
      window.localStorage.setItem(`${COLLAPSE_KEY}:pin`, v ? "0" : "1");
      return !v;
    });
  };

  const iconBtn: React.CSSProperties = {
    background: "transparent",
    border: 0,
    cursor: "pointer",
    color: "#747474",
    padding: 4,
    borderRadius: 4,
    display: "inline-flex",
    alignItems: "center",
  };

  return (
    <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
      {open && (
        <aside
          style={{
            width: 300,
            background: "#fff",
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            marginRight: 8,
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 140px)",
            position: "sticky",
            top: 8,
          }}
        >
          {/* Header row: icon + view name + pin + display selector */}
          <header style={{ padding: "10px 12px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  background: "#7f8de1",
                  flexShrink: 0,
                }}
              >
                <svg style={{ width: 15, height: 15, fill: "#fff" }} aria-hidden="true">
                  <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${entity.toLowerCase()}`} />
                </svg>
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#181818", flex: 1 }}>
                Recently Viewed
              </span>
              <button
                onClick={togglePin}
                title={pinned ? "Unpin list" : "Pin list"}
                style={{ ...iconBtn, color: pinned ? "#0176d3" : "#747474" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16 3l5 5-6 2-4 8-2-2-5 5-1-1 5-5-2-2 8-4z" />
                </svg>
              </button>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Select list display"
                  style={{
                    ...iconBtn,
                    border: "1px solid #c9c9c9",
                    background: "#0176d3",
                    color: "#fff",
                    padding: "4px 8px",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                    <path d="M0 2.5l5 5 5-5z" />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: 28,
                      right: 0,
                      zIndex: 40,
                      background: "#fff",
                      border: "1px solid #c9c9c9",
                      borderRadius: 4,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      minWidth: 170,
                      padding: "4px 0",
                    }}
                  >
                    <Link
                      href={`/${param}`}
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "block", padding: "7px 14px", fontSize: 13, color: "#181818", textDecoration: "none" }}
                    >
                      Open full list (Table)
                    </Link>
                    <Link
                      href={`/${param}?display=kanban`}
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "block", padding: "7px 14px", fontSize: 13, color: "#181818", textDecoration: "none" }}
                    >
                      Open Kanban
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        toggle();
                      }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 14px", fontSize: 13, color: "#181818", background: "transparent", border: 0, cursor: "pointer" }}
                    >
                      Collapse split view
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#747474", flex: 1 }}>
                {visible.length} items
                {refreshedAt
                  ? ` · Updated ${refreshedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </span>
              <button onClick={load} title="Refresh" style={iconBtn}>
                <svg width="12" height="12" viewBox="0 0 52 52" fill="currentColor" aria-hidden="true">
                  <path d="M26 9c-9.4 0-17 7.6-17 17 0 1.7.3 3.4.8 5l-3.5-2c-.4-.2-.9-.1-1.2.3l-1 1.5c-.3.4-.2.9.2 1.2l7 4.1c.5.3 1.1.1 1.4-.3l4.1-7c.3-.5.1-1.1-.3-1.4l-1.5-1c-.4-.3-.9-.2-1.2.2l-1.7 2.5c-.3-1.4-.4-2.7-.4-4.1 0-7.1 5.8-12.9 12.9-12.9 4.1 0 7.7 1.9 10.1 4.9.4.4 1 .5 1.4.1l1.5-1.3c.4-.4.4-1 0-1.4C36.2 11.6 31.4 9 26 9zm17.7 21.2l-7-4.1c-.5-.3-1.1-.1-1.4.3l-4.1 7c-.3.5-.1 1.1.3 1.4l1.5 1c.4.3 1 .2 1.2-.2l1.6-2.4c.3 1.3.4 2.5.4 3.8 0 7.1-5.8 12.9-12.9 12.9-4.1 0-7.7-1.9-10.1-4.9-.4-.4-1-.5-1.4-.1l-1.5 1.3c-.4.4-.4 1 0 1.4 3 3.7 7.8 6.3 13.2 6.3 9.4 0 17-7.6 17-17 0-1.7-.3-3.4-.8-4.9l3.5 2c.4.2.9.1 1.2-.3l1-1.5c.4-.4.3-1-.1-1.2z" />
                </svg>
              </button>
            </div>
          </header>

          {/* Search */}
          <div style={{ padding: "4px 12px 8px" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this list..."
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px",
                border: "1px solid #c9c7c5",
                borderRadius: 15,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Sort header */}
          <button
            onClick={() =>
              setSortDir((d) => (d === "recent" ? "asc" : d === "asc" ? "desc" : "recent"))
            }
            title="Sort"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderTop: "1px solid #ecebea",
              borderBottom: "1px solid #ecebea",
              background: "#fafaf9",
              border: 0,
              borderRadius: 0,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              color: "#181818",
              textAlign: "left",
            }}
          >
            Recently Viewed
            <span style={{ color: "#747474" }}>
              {sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : "↓"}
            </span>
          </button>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {visible.map((r2) => {
              const active = pathname === r2.href;
              const isChecked = checked.has(r2.id);
              return (
                <div
                  key={r2.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "7px 10px",
                    borderBottom: "1px solid #f3f3f3",
                    borderLeft: active ? "3px solid #0176d3" : "3px solid transparent",
                    background: active ? "rgba(0,112,210,0.08)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r2.id);
                        else next.delete(r2.id);
                        return next;
                      })
                    }
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <Link href={r2.href} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0176d3",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r2.title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#444444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r2.sub ?? ""}
                      </span>
                      <span style={{ fontSize: 12, color: "#747474", whiteSpace: "nowrap" }}>{r2.meta ?? ""}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: "#747474" }}>
                {rows.length === 0 ? "Loading..." : "No records match."}
              </div>
            )}
          </div>
        </aside>
      )}
      <button
        onClick={toggle}
        aria-label={open ? "Collapse list" : "Expand list"}
        title={open ? "Collapse list" : "Expand list"}
        style={{
          alignSelf: "center",
          width: 14,
          height: 44,
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: open ? "0 4px 4px 0" : 4,
          marginRight: 8,
          marginLeft: open ? -9 : 0,
          cursor: "pointer",
          color: "#747474",
          fontSize: 9,
          padding: 0,
          flexShrink: 0,
        }}
      >
        {open ? "◀" : "▶"}
      </button>
    </div>
  );
}
