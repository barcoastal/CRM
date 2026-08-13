"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * SF console split view: a collapsible record list docked left of an open
 * record. Shows the object's most recent records; the open record is
 * highlighted. Console mode only (RecordPage decides when to render it).
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

  useEffect(() => {
    // Console mode only, and respect the user's collapse choice.
    const consoleMode = window.localStorage.getItem("sf:navMode.v1") !== "standard";
    if (!consoleMode || !param) return;
    setReady(true);
    setOpen(window.localStorage.getItem(COLLAPSE_KEY) !== "closed");
  }, [param]);

  useEffect(() => {
    if (!ready || !open || !param) return;
    fetch(`/api/split-list?entity=${param}`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows?: SplitRow[] }) => setRows(d.rows ?? []))
      .catch(() => undefined);
  }, [ready, open, param]);

  if (!ready || !param) return null;

  const toggle = () => {
    setOpen((v) => {
      window.localStorage.setItem(COLLAPSE_KEY, v ? "closed" : "open");
      return !v;
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
      {open && (
        <aside
          style={{
            width: 280,
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
          <header
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #ecebea",
              fontSize: 13,
              fontWeight: 700,
              color: "#181818",
            }}
          >
            Recently Viewed
            <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "#747474" }}>
              {rows.length} items
            </span>
          </header>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {rows.map((r2) => {
              const active = pathname === r2.href;
              return (
                <Link
                  key={r2.id}
                  href={r2.href}
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    borderBottom: "1px solid #f3f3f3",
                    borderLeft: active ? "3px solid #0176d3" : "3px solid transparent",
                    background: active ? "rgba(0,112,210,0.08)" : "transparent",
                    textDecoration: "none",
                  }}
                >
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
              );
            })}
            {rows.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: "#747474" }}>Loading...</div>
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
