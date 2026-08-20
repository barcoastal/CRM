"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * SF Console navigation, modeled on the org's "Debt Settlement Console":
 * app name | current-object dropdown | workspace tabs for every open record.
 *
 * Two-level tabs, like the SF console:
 *  - A record opened from a list/nav becomes a PRIMARY workspace tab (row 1).
 *  - A record opened from INSIDE another record (e.g. the Account you click on
 *    an Opportunity) becomes a SUBTAB nested under that primary tab (row 2).
 * Nesting is one level deep: a record opened from a subtab attaches to the same
 * primary. Tabs persist per browser (localStorage).
 *
 * Record pages register themselves via a "console-tab" CustomEvent fired by
 * RegisterConsoleTab inside RecordPage. That event also carries the "opener"
 * (the record you were viewing when you navigated here) so the nav can decide
 * primary-vs-subtab.
 */

export interface ConsoleTab {
  href: string;
  label: string;
  entity: string;
  parentHref?: string; // set => this is a subtab of that primary tab
}

const STORE_KEY = "sf:consoleTabs.v2";
const MODE_KEY = "sf:navMode.v1"; // "console" | "standard"

// A record detail route: /opportunities/<id>, /accounts/<id>, etc.
const RECORD_ROUTE = /^\/(opportunities|accounts|leads|contacts|cases)\/[^/]+$/;

// Module-level tracker: the record href you were last viewing. Set by
// RegisterConsoleTab when a record mounts; cleared when you land on a
// non-record page (list/nav). Read as the "opener" for the next record.
let openerHref: string | null = null;

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
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function writeTabs(tabs: ConsoleTab[]) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(tabs.slice(0, 30)));
}

const ENTITY_COLOR: Record<string, string> = {
  Account: "#7f8de1",
  Contact: "#a094ed",
  Lead: "#f88962",
  Opportunity: "#ff9a3c",
  Case: "#f2cf5b",
};

function EntityIcon({ entity, size = 18 }: { entity: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 3,
        background: ENTITY_COLOR[entity] ?? "#747474",
        flexShrink: 0,
      }}
    >
      <svg style={{ width: size * 0.6, height: size * 0.6, fill: "#fff" }} aria-hidden="true">
        <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${entity.toLowerCase()}`} />
      </svg>
    </span>
  );
}

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

  // Clear the opener whenever we're not on a record page, so a record opened
  // from a list view starts a fresh primary tab (not a subtab of whatever
  // record we happened to view earlier).
  useEffect(() => {
    if (pathname && !RECORD_ROUTE.test(pathname)) openerHref = null;
  }, [pathname]);

  useEffect(() => {
    setTabs(readTabs());
    const onTab = (e: Event) => {
      const d = (e as CustomEvent<ConsoleTab & { opener?: string | null }>).detail;
      if (!d?.href) return;
      setTabs((prev) => {
        // Existing tab: just refresh its label.
        if (prev.some((t) => t.href === d.href)) {
          const next = prev.map((t) => (t.href === d.href ? { ...t, label: d.label } : t));
          writeTabs(next);
          return next;
        }
        // New tab: nest under the opener's primary if we came from a record.
        let parentHref: string | undefined;
        if (d.opener && d.opener !== d.href) {
          const op = prev.find((t) => t.href === d.opener);
          if (op) parentHref = op.parentHref ?? op.href;
        }
        const next = [...prev, { href: d.href, label: d.label, entity: d.entity, parentHref }];
        writeTabs(next);
        return next;
      });
    };
    window.addEventListener("console-tab", onTab);
    return () => window.removeEventListener("console-tab", onTab);
  }, []);

  const closeTab = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTabs((prev) => {
      const target = prev.find((t) => t.href === href);
      // Closing a primary also closes its subtabs.
      const toRemove = new Set<string>([href]);
      prev.forEach((t) => {
        if (t.parentHref === href) toRemove.add(t.href);
      });
      const next = prev.filter((t) => !toRemove.has(t.href));
      writeTabs(next);
      if (toRemove.has(pathname)) {
        let dest: string | undefined;
        if (target?.parentHref && next.some((t) => t.href === target.parentHref)) {
          dest = target.parentHref; // fall back to the parent record
        } else {
          const primaries = next.filter((t) => !t.parentHref);
          dest = primaries[primaries.length - 1]?.href;
        }
        router.push(dest ?? objects[0]?.href ?? "/dashboard");
      }
      return next;
    });
  };

  const currentObject =
    objects.find((o) => o.href !== "/dashboard" && pathname.startsWith(o.href)) ??
    objects.find((o) => pathname === o.href) ??
    objects[0];

  const primaries = tabs.filter((t) => !t.parentHref);
  const activeTab = tabs.find((t) => t.href === pathname);
  const activePrimaryHref = activeTab ? activeTab.parentHref ?? activeTab.href : null;
  const activePrimary = tabs.find((t) => t.href === activePrimaryHref);
  const children = activePrimaryHref
    ? tabs.filter((t) => t.parentHref === activePrimaryHref)
    : [];
  // Row 2 shows the primary record itself as the first subtab, then its children.
  const subtabs: ConsoleTab[] = activePrimary && children.length > 0 ? [activePrimary, ...children] : [];

  return (
    <div style={{ borderBottom: "1px solid #c9c9c9", background: "#fff" }}>
      {/* Row 1: app name + object switcher + primary workspace tabs */}
      <div style={{ display: "flex", alignItems: "stretch", height: 36, paddingLeft: 8 }}>
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

        {/* Primary workspace tabs */}
        <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", flex: 1 }}>
          {primaries.map((t) => {
            const active = t.href === activePrimaryHref;
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
                <EntityIcon entity={t.entity} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.label}</span>
                <button
                  onClick={closeTab(t.href)}
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

      {/* Row 2: subtabs for the active primary tab (SF-style nested tabs) */}
      {subtabs.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            height: 30,
            background: "#f3f2f2",
            borderTop: "1px solid #e5e5e5",
            paddingLeft: 12,
            overflowX: "auto",
          }}
        >
          {subtabs.map((t, i) => {
            const active = t.href === pathname;
            const isPrimaryRecord = i === 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                title={t.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: 180,
                  minWidth: 110,
                  padding: "0 8px",
                  borderRight: "1px solid #e0e0e0",
                  background: active ? "#fff" : "transparent",
                  borderBottom: active ? "2px solid #0176d3" : "2px solid transparent",
                  fontSize: 12,
                  color: "#181818",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <EntityIcon entity={t.entity} size={14} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.label}</span>
                {/* The primary record subtab is not closable here (close it from row 1). */}
                {!isPrimaryRecord && (
                  <button
                    onClick={closeTab(t.href)}
                    aria-label={`Close ${t.label}`}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "#747474",
                      cursor: "pointer",
                      fontSize: 13,
                      lineHeight: 1,
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Drop into record pages: registers/updates the workspace tab for the record. */
export function RegisterConsoleTab({ label, entity }: { label: string; entity: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    // The record we were viewing before this one is the "opener" used to decide
    // primary-vs-subtab. Capture it, announce this tab, then become the opener
    // for whatever record is opened next.
    const opener = openerHref && openerHref !== pathname ? openerHref : null;
    window.dispatchEvent(
      new CustomEvent<ConsoleTab & { opener: string | null }>("console-tab", {
        detail: { href: pathname, label, entity, opener },
      }),
    );
    openerHref = pathname;
  }, [pathname, label, entity]);
  return null;
}
