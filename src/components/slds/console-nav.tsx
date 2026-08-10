"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * SF Console navigation, modeled on the org's "Debt Settlement Console":
 * app name | current-object dropdown | workspace tabs for every open record
 * (36px tall, ~220px wide, light blue active tint, close X). Open a record
 * anywhere and it becomes a tab; tabs persist per browser (localStorage).
 *
 * Record pages register themselves via a "console-tab" CustomEvent fired by
 * RegisterConsoleTab inside RecordPage.
 */

export interface ConsoleTab {
  href: string;
  label: string;
  entity: string;
}

const STORE_KEY = "sf:consoleTabs.v1";
const MODE_KEY = "sf:navMode.v1"; // "console" | "standard"

export function readNavMode(): "console" | "standard" {
  if (typeof window === "undefined") return "console";
  return window.localStorage.getItem(MODE_KEY) === "standard" ? "standard" : "console";
}

export function setNavMode(mode: "console" | "standard") {
  window.localStorage.setItem(MODE_KEY, mode);
  window.location.reload();
}

function readTabs(): ConsoleTab[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ConsoleTab[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 15) : [];
  } catch {
    return [];
  }
}

function writeTabs(tabs: ConsoleTab[]) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(tabs.slice(0, 15)));
}

const ENTITY_COLOR: Record<string, string> = {
  Account: "#7f8de1",
  Contact: "#a094ed",
  Lead: "#f88962",
  Opportunity: "#ff9a3c",
  Case: "#f2cf5b",
};

export function ConsoleNav({
  appName,
  objects,
}: {
  appName: string;
  objects: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<ConsoleTab[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTabs(readTabs());
    const onTab = (e: Event) => {
      const d = (e as CustomEvent<ConsoleTab>).detail;
      if (!d?.href) return;
      setTabs((prev) => {
        if (prev.some((t) => t.href === d.href)) {
          const next = prev.map((t) => (t.href === d.href ? { ...t, label: d.label } : t));
          writeTabs(next);
          return next;
        }
        const next = [...prev, d];
        writeTabs(next);
        return next;
      });
    };
    window.addEventListener("console-tab", onTab);
    return () => window.removeEventListener("console-tab", onTab);
  }, []);

  const close = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.href === href);
      const next = prev.filter((t) => t.href !== href);
      writeTabs(next);
      if (pathname === href) {
        const fallback = next[idx - 1] ?? next[idx] ?? null;
        router.push(fallback ? fallback.href : objects[0]?.href ?? "/dashboard");
      }
      return next;
    });
  };

  const currentObject =
    objects.find((o) => o.href !== "/dashboard" && pathname.startsWith(o.href)) ??
    objects.find((o) => pathname === o.href) ??
    objects[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "#fff",
        borderBottom: "1px solid #c9c9c9",
        height: 36,
        paddingLeft: 8,
      }}
    >
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 12px 0 4px",
          fontSize: 14,
          fontWeight: 700,
          color: "#080707",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {appName}
      </Link>

      {/* Current-object dropdown (console object switcher) */}
      <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: 0,
            borderLeft: "1px solid #e5e5e5",
            borderRight: "1px solid #e5e5e5",
            padding: "0 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "#181818",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {currentObject?.label ?? "Home"}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#747474" }} aria-hidden="true">
            <path d="M0 2.5l5 5 5-5z" />
          </svg>
        </button>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 0,
              zIndex: 60,
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              minWidth: 220,
              padding: "4px 0",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            {objects.map((o) => (
              <Link
                key={o.href}
                href={o.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "7px 14px",
                  fontSize: 13,
                  color: "#181818",
                  textDecoration: "none",
                  background: currentObject?.href === o.href ? "#f3f3f3" : "transparent",
                }}
              >
                {o.label}
              </Link>
            ))}
            <div style={{ borderTop: "1px solid #ecebea", marginTop: 4, paddingTop: 4 }}>
              <button
                onClick={() => setNavMode("standard")}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 14px",
                  fontSize: 12,
                  color: "#747474",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Switch to standard navigation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace tabs */}
      <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", flex: 1 }}>
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              title={t.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: 200,
                minWidth: 120,
                padding: "0 8px",
                borderRight: "1px solid #e5e5e5",
                borderTop: active ? "2px solid #181818" : "2px solid transparent",
                background: active ? "rgba(0, 112, 210, 0.1)" : "#fff",
                fontSize: 13,
                color: "#181818",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  background: ENTITY_COLOR[t.entity] ?? "#747474",
                  flexShrink: 0,
                }}
              >
                <svg style={{ width: 11, height: 11, fill: "#fff" }} aria-hidden="true">
                  <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${t.entity.toLowerCase()}`} />
                </svg>
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.label}</span>
              <button
                onClick={close(t.href)}
                aria-label={`Close ${t.label}`}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#747474",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 2,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Drop into record pages: registers/updates the workspace tab for the record. */
export function RegisterConsoleTab({ label, entity }: { label: string; entity: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    window.dispatchEvent(
      new CustomEvent<ConsoleTab>("console-tab", { detail: { href: pathname, label, entity } }),
    );
  }, [pathname, label, entity]);
  return null;
}
