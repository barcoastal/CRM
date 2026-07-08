"use client";

import { useEffect, useRef, useState } from "react";
import { ObjectIcon } from "./icon";

export type NavItem = {
  label: string;
  href: string;
  entity?: string;
};

const ORDER_KEY = "sf:navOrder";
const HIDDEN_KEY = "sf:navHidden";

export function loadNavPrefs(): { order: string[]; hidden: string[] } {
  try {
    const order = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as string[];
    const hidden = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[];
    return { order: Array.isArray(order) ? order : [], hidden: Array.isArray(hidden) ? hidden : [] };
  } catch {
    return { order: [], hidden: [] };
  }
}

export function applyNavPrefs(tabs: NavItem[]): NavItem[] {
  if (typeof window === "undefined") return tabs;
  const { order, hidden } = loadNavPrefs();
  const byHref = new Map(tabs.map((t) => [t.href, t]));
  const hiddenSet = new Set(hidden);
  const ordered: NavItem[] = [];
  for (const href of order) {
    const t = byHref.get(href);
    if (t) {
      ordered.push(t);
      byHref.delete(href);
    }
  }
  for (const t of tabs) {
    if (byHref.has(t.href)) {
      ordered.push(t);
      byHref.delete(t.href);
    }
  }
  return ordered.filter((t) => !hiddenSet.has(t.href));
}

export function EditNavModal({
  open,
  onClose,
  allTabs,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  allTabs: NavItem[];
  onSaved: () => void;
}) {
  const [items, setItems] = useState<NavItem[]>(allTabs);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const draggingHref = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const { order, hidden: hiddenList } = loadNavPrefs();
    const byHref = new Map(allTabs.map((t) => [t.href, t]));
    const next: NavItem[] = [];
    for (const href of order) {
      const t = byHref.get(href);
      if (t) {
        next.push(t);
        byHref.delete(href);
      }
    }
    for (const t of allTabs) if (byHref.has(t.href)) next.push(t);
    setItems(next);
    setHidden(new Set(hiddenList));
  }, [open, allTabs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function moveItem(href: string, delta: number) {
    setItems((cur) => {
      const idx = cur.findIndex((t) => t.href === href);
      if (idx < 0) return cur;
      const target = idx + delta;
      if (target < 0 || target >= cur.length) return cur;
      const next = cur.slice();
      const [it] = next.splice(idx, 1);
      next.splice(target, 0, it);
      return next;
    });
  }

  function toggleHidden(href: string) {
    setHidden((cur) => {
      const next = new Set(cur);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  function onDragStart(href: string) { draggingHref.current = href; }
  function onDragOver(e: React.DragEvent, overHref: string) {
    e.preventDefault();
    const src = draggingHref.current;
    if (!src || src === overHref) return;
    setItems((cur) => {
      const a = cur.findIndex((t) => t.href === src);
      const b = cur.findIndex((t) => t.href === overHref);
      if (a < 0 || b < 0) return cur;
      const next = cur.slice();
      const [it] = next.splice(a, 1);
      next.splice(b, 0, it);
      return next;
    });
  }
  function onDragEnd() { draggingHref.current = null; }

  function save() {
    localStorage.setItem(ORDER_KEY, JSON.stringify(items.map((t) => t.href)));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
    onSaved();
    onClose();
  }

  function resetDefault() {
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(HIDDEN_KEY);
    onSaved();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9600,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 4,
          width: "min(720px, 100%)",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #c9c9c9", display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181818", flex: 1, margin: 0 }}>
            Edit App Navigation Items
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: 0, fontSize: 22, cursor: "pointer", color: "#747474" }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #ecebea", fontSize: 12, color: "#444656" }}>
          Drag to reorder. Toggle visibility with the checkbox. Hidden items still work via direct URL or the App Launcher.
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {items.map((t, i) => {
            const isHidden = hidden.has(t.href);
            return (
              <div
                key={t.href}
                draggable
                onDragStart={() => onDragStart(t.href)}
                onDragOver={(e) => onDragOver(e, t.href)}
                onDragEnd={onDragEnd}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 20px",
                  borderBottom: "1px solid #f3f2f2",
                  cursor: "grab",
                  background: isHidden ? "#fafaf9" : "#fff",
                  opacity: isHidden ? 0.55 : 1,
                }}
              >
                <span style={{ color: "#b0adab", fontSize: 16, lineHeight: 1, width: 14, textAlign: "center" }} aria-hidden="true">⋮⋮</span>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(t.href)}
                  aria-label={`Show ${t.label}`}
                />
                {t.entity ? (
                  <ObjectIcon entity={t.entity} size="x-small" />
                ) : (
                  <span style={{ width: 20, height: 20, background: "#c9c9c9", borderRadius: 2, display: "inline-block" }} />
                )}
                <div style={{ flex: 1, fontSize: 13, color: "#181818" }}>{t.label}</div>
                <span style={{ fontSize: 11, color: "#747474", marginRight: 6 }}>{i + 1}</span>
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => moveItem(t.href, -1)}
                  style={{ background: "transparent", border: 0, color: "#3052ff", cursor: "pointer", padding: 2 }}
                >▲</button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => moveItem(t.href, 1)}
                  style={{ background: "transparent", border: 0, color: "#3052ff", cursor: "pointer", padding: 2 }}
                >▼</button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #c9c9c9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={resetDefault}
            style={{ background: "transparent", border: 0, color: "#3052ff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Reset Navigation to Default
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#444656" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              style={{ padding: "8px 20px", background: "#3052ff", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
