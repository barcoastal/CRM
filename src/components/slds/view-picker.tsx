"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export interface ListViewOption {
  id: string;
  name: string;
  developerName: string | null;
  isPinned: boolean;
  isSystem: boolean;
  isShared: boolean;
}

/**
 * SF-style list view picker dropdown.
 * Sits above the table on list pages. The active view is selected via ?view=devName
 * in the URL; the picker is purely client-side (state in URL).
 */
export function ViewPicker({
  views,
  currentName,
  entity,
}: {
  views: ListViewOption[];
  currentName: string;
  entity: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pickView(devName: string | null) {
    const url = new URL(window.location.href);
    if (devName) url.searchParams.set("view", devName);
    else url.searchParams.delete("view");
    router.push(url.pathname + url.search);
    setOpen(false);
  }

  const pinned = views.filter((v) => v.isPinned);
  const recent = views.filter((v) => !v.isPinned);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: 0,
          fontSize: 18, fontWeight: 700, color: "#181818",
          cursor: "pointer", padding: 0,
        }}
      >
        {currentName}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: "#54698d" }}>
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: 30, left: 0,
            background: "#fff", border: "1px solid #c9c9c9",
            borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            minWidth: 280, maxHeight: 480, overflowY: "auto",
            zIndex: 9000,
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #ecebea", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#444444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, flex: 1 }}>
              List Views
            </span>
            <Link
              href={`/settings/list-views/new?entity=${entity}&returnTo=${encodeURIComponent(window.location.pathname)}`}
              style={{ fontSize: 12, color: "#0176d3", textDecoration: "none" }}
              onClick={() => setOpen(false)}
            >
              + New
            </Link>
          </div>

          {pinned.length > 0 && (
            <>
              <div style={{ padding: "4px 12px", fontSize: 11, color: "#747474" }}>Pinned</div>
              {pinned.map((v) => (
                <ViewRow key={v.id} view={v} active={params.get("view") === v.developerName} onClick={() => pickView(v.developerName)} />
              ))}
              {recent.length > 0 && <div style={{ borderTop: "1px solid #f3f3f3" }} />}
            </>
          )}

          {recent.length > 0 && (
            <>
              <div style={{ padding: "4px 12px", fontSize: 11, color: "#747474" }}>All Views</div>
              {recent.map((v) => (
                <ViewRow key={v.id} view={v} active={params.get("view") === v.developerName} onClick={() => pickView(v.developerName)} />
              ))}
            </>
          )}

          {views.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: "#747474" }}>
              No saved views. Click + New to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewRow({
  view, active, onClick,
}: { view: ListViewOption; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "8px 12px",
        background: active ? "#f3f9fe" : "transparent",
        border: 0, cursor: "pointer", textAlign: "left",
        fontSize: 13, color: "#181818",
      }}
      className="sf-view-row"
    >
      <span style={{ flex: 1 }}>{view.name}</span>
      {view.isSystem && (
        <span style={{ fontSize: 10, color: "#747474" }}>System</span>
      )}
      {active && (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "#0176d3", flexShrink: 0 }}>
          <path d="M5 10.5L2 7.5l1-1L5 8.5 11 2.5l1 1z" />
        </svg>
      )}
      <style jsx>{`
        :global(.sf-view-row:hover) { background: #f3f2f2; }
      `}</style>
    </button>
  );
}
