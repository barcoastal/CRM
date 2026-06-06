"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type SfCellAlign = "left" | "right";

export interface SfColumn<T> {
  /** stable key */
  key: string;
  /** header label as it appears in SF */
  label: string;
  /** optional truncate width in px (header + cell) */
  width?: number;
  /** render cell content */
  render: (row: T) => React.ReactNode;
  /** comparator value used for client-side sort + search-text */
  sortValue?: (row: T) => string | number | null | undefined;
  /** plain text used by the in-list search box */
  searchText?: (row: T) => string | null | undefined;
  /** cell alignment, default left */
  align?: SfCellAlign;
}

export interface SfListAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface SfListViewOption {
  /** label shown in the dropdown */
  label: string;
  /** value used as ?view= URL param. "" means default (Recently Viewed) */
  value: string;
  /** if true, show a check mark */
  active?: boolean;
}

export interface SfListPageProps<T extends { id: string }> {
  /** entity slug (e.g. "lead", "opportunity", "account", "contact") */
  entity: string;
  /** plural title, e.g. "Leads" */
  title: string;
  /** subtitle like "Recently Viewed" — appears as the big bold dropdown label */
  subtitle: string;
  /** total items count */
  count: number;
  /** the SLDS standard sprite color class — driven via `iconColor` (background hex) */
  iconColor?: string;
  /** SLDS standard icon slug, e.g. "lead", "opportunity" */
  iconSlug: string;
  /** right-aligned header action buttons */
  actions: SfListAction[];
  /** row link target (first text column wraps in a Link to this href) */
  rowHref?: (row: T) => string;
  /** the columns */
  columns: SfColumn<T>[];
  /** the rows */
  rows: T[];
  /** list view options (e.g. Recently Viewed, All Leads, ...) */
  views?: SfListViewOption[];
  /** name of the column that should be a Link (first by default) */
  primaryColumnKey?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function SfListPage<T extends { id: string }>(props: SfListPageProps<T>) {
  const {
    entity,
    title,
    subtitle,
    count,
    iconColor,
    iconSlug,
    actions,
    rowHref,
    columns,
    rows,
    views,
    primaryColumnKey,
  } = props;

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const firstTextColumnKey = primaryColumnKey ?? columns[0]?.key;

  // client-side filter + sort
  const visibleRows = useMemo(() => {
    let out = rows.slice();
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.searchText ? c.searchText(r) : null;
          if (typeof v === "string") return v.toLowerCase().includes(q);
          return false;
        }),
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        out.sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number") {
            return sortDir === "asc" ? av - bv : bv - av;
          }
          const as = String(av).toLowerCase();
          const bs = String(bv).toLowerCase();
          return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
        });
      }
    }
    return out;
  }, [rows, columns, query, sortKey, sortDir]);

  function clickHeader(c: SfColumn<T>) {
    if (!c.sortValue) return;
    if (sortKey === c.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(c.key);
      setSortDir("asc");
    }
  }

  const [allChecked, setAllChecked] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  function toggleAll() {
    const next = !allChecked;
    setAllChecked(next);
    if (next) {
      const m: Record<string, boolean> = {};
      visibleRows.forEach((r) => (m[r.id] = true));
      setCheckedIds(m);
    } else {
      setCheckedIds({});
    }
  }
  function toggleRow(id: string) {
    setCheckedIds((m) => ({ ...m, [id]: !m[id] }));
  }

  return (
    <div style={{ padding: 0 }}>
      <SfListHeader
        entity={entity}
        iconSlug={iconSlug}
        iconColor={iconColor}
        title={title}
        subtitle={subtitle}
        count={count}
        actions={actions}
        views={views}
        query={query}
        setQuery={setQuery}
      />

      <div
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderTop: "none",
        }}
      >
        <table
          className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover"
          role="grid"
          style={{
            tableLayout: "auto",
            width: "100%",
            fontSize: 12,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr className="slds-line-height_reset">
              <th
                scope="col"
                style={{
                  width: 32,
                  padding: "0 6px",
                  background: "#fafaf9",
                  borderBottom: "1px solid #dddbda",
                }}
              >
                <span
                  className="slds-checkbox slds-checkbox_standalone"
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                  <span className="slds-checkbox_faux" />
                </span>
              </th>
              <th
                scope="col"
                style={{
                  width: 40,
                  background: "#fafaf9",
                  borderBottom: "1px solid #dddbda",
                  fontSize: 11,
                  color: "#3e3e3c",
                  fontWeight: 700,
                  padding: "0 8px",
                  textAlign: "left",
                }}
              />
              {columns.map((c) => {
                const isSorted = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{
                      background: "#fafaf9",
                      borderBottom: "1px solid #dddbda",
                      borderRight: "1px solid #dddbda",
                      padding: 0,
                      width: c.width,
                      textAlign: c.align === "right" ? "right" : "left",
                    }}
                  >
                    <a
                      className="slds-th__action slds-text-link_reset"
                      href="#"
                      role="button"
                      onClick={(e) => {
                        e.preventDefault();
                        clickHeader(c);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 8px",
                        color: "#080707",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                        cursor: c.sortValue ? "pointer" : "default",
                        justifyContent:
                          c.align === "right" ? "flex-end" : "flex-start",
                      }}
                    >
                      <span
                        className="slds-truncate"
                        title={c.label}
                        style={{ flex: 1, textAlign: c.align === "right" ? "right" : "left" }}
                      >
                        {c.label}
                      </span>
                      <SortIcon
                        active={isSorted}
                        dir={isSorted ? sortDir : null}
                      />
                    </a>
                  </th>
                );
              })}
              <th
                scope="col"
                style={{
                  width: 32,
                  background: "#fafaf9",
                  borderBottom: "1px solid #dddbda",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 3}
                  style={{
                    textAlign: "center",
                    padding: 48,
                    color: "#706e6b",
                    fontSize: 13,
                  }}
                >
                  No records to display.
                </td>
              </tr>
            )}
            {visibleRows.map((row, idx) => {
              const checked = !!checkedIds[row.id];
              return (
                <tr
                  key={row.id}
                  className="slds-hint-parent"
                  style={{
                    background: checked ? "#f3f9fe" : undefined,
                  }}
                >
                  <td
                    role="gridcell"
                    style={{
                      padding: "0 6px",
                      borderBottom: "1px solid #f3f2f2",
                    }}
                  >
                    <span
                      className="slds-checkbox slds-checkbox_standalone"
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${idx + 1}`}
                        checked={checked}
                        onChange={() => toggleRow(row.id)}
                      />
                      <span className="slds-checkbox_faux" />
                    </span>
                  </td>
                  <td
                    role="gridcell"
                    style={{
                      padding: "6px 8px",
                      fontSize: 12,
                      color: "#3e3e3c",
                      borderBottom: "1px solid #f3f2f2",
                    }}
                  >
                    {idx + 1}
                  </td>
                  {columns.map((c) => {
                    const isPrimary = c.key === firstTextColumnKey;
                    const href = rowHref?.(row);
                    return (
                      <td
                        key={c.key}
                        role="gridcell"
                        style={{
                          padding: "6px 8px",
                          fontSize: 12,
                          color: "#080707",
                          borderBottom: "1px solid #f3f2f2",
                          borderRight: "1px solid #f3f2f2",
                          textAlign: c.align === "right" ? "right" : "left",
                          maxWidth: c.width,
                        }}
                      >
                        <div
                          className="slds-truncate"
                          style={{
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isPrimary && href ? (
                            <Link
                              href={href}
                              style={{
                                color: "#1589ee",
                                textDecoration: "none",
                              }}
                            >
                              {c.render(row)}
                            </Link>
                          ) : (
                            c.render(row)
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td
                    role="gridcell"
                    style={{
                      padding: "0 4px",
                      textAlign: "center",
                      borderBottom: "1px solid #f3f2f2",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Row actions"
                      style={{
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 3,
                        color: "#706e6b",
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontSize: 10,
                      }}
                      onClick={(e) => e.preventDefault()}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path
                          d="M2 4l4 4 4-4z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header + view picker                                               */
/* ------------------------------------------------------------------ */

function SfListHeader({
  entity,
  iconSlug,
  iconColor,
  title,
  subtitle,
  count,
  actions,
  views,
  query,
  setQuery,
}: {
  entity: string;
  iconSlug: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  count: number;
  actions: SfListAction[];
  views?: SfListViewOption[];
  query: string;
  setQuery: (v: string) => void;
}) {
  void entity;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderBottom: "none",
        padding: "10px 16px 6px",
      }}
    >
      {/* Row 1: object icon + title + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: iconColor ?? "#f88962",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
            }}
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              style={{ fill: "#fff" }}
            >
              <use
                xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${iconSlug}`}
              />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: "#3e3e3c",
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>
            <ViewPickerInline
              subtitle={subtitle}
              views={views}
            />
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: "#3e3e3c",
              }}
            >
              {count} item{count === 1 ? "" : "s"} <span style={{ color: "#706e6b" }}>· Updated a few seconds ago</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 0,
            flexShrink: 0,
            border: "1px solid #dddbda",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {actions.map((a, i) => {
            const inner = (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  background: "#fff",
                  color: "#0070d2",
                  fontSize: 13,
                  fontWeight: 400,
                  cursor: "pointer",
                  borderRight:
                    i < actions.length - 1 ? "1px solid #dddbda" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                {a.label}
              </span>
            );
            if (a.href) {
              return (
                <Link key={a.label} href={a.href} style={{ textDecoration: "none" }}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                style={{ background: "transparent", border: 0, padding: 0 }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: search + tool icons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          marginTop: 8,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 240,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fill: "#706e6b",
            }}
          >
            <path d="M11 4a7 7 0 1 0 4.193 12.572l3.118 3.118 1.414-1.414-3.118-3.118A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
          </svg>
          <input
            type="search"
            placeholder="Search this list..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "4px 8px 4px 26px",
              fontSize: 13,
              border: "1px solid #dddbda",
              borderRadius: 4,
              outline: "none",
              background: "#fff",
              color: "#080707",
            }}
          />
        </div>
        <IconBtn ariaLabel="List controls">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.3-2.4h-4l-.3 2.4a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.4h4l.3-2.4a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Choose view">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <rect x="3" y="4" width="18" height="3" />
            <rect x="3" y="10" width="18" height="3" />
            <rect x="3" y="16" width="18" height="3" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <path d="M17.65 6.35A8 8 0 0 0 4 12h2a6 6 0 0 1 10.24-4.24L13 11h7V4l-2.35 2.35z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Sort">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <path d="M7 4l-4 5h3v11h2V9h3L7 4zm10 16l4-5h-3V4h-2v11h-3l4 5z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Edit list">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Filters">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#706e6b" }}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46" />
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "1px solid #dddbda",
        background: "#fff",
        borderRadius: 4,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function ViewPickerInline({
  subtitle,
  views,
}: {
  subtitle: string;
  views?: SfListViewOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: 18,
          fontWeight: 700,
          color: "#080707",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          lineHeight: 1.2,
        }}
      >
        {subtitle}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: "#080707" }}>
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>

      {open && views && views.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            zIndex: 9000,
            background: "#fff",
            border: "1px solid #dddbda",
            borderRadius: 4,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            minWidth: 240,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              fontSize: 11,
              color: "#3e3e3c",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              borderBottom: "1px solid #ecebea",
            }}
          >
            List Views
          </div>
          {views.map((v) => {
            const isActive = !!v.active;
            return (
              <button
                key={v.value || "default"}
                type="button"
                onClick={() => {
                  const sp = new URLSearchParams();
                  if (v.value) sp.set("view", v.value);
                  router.push(pathname + (sp.toString() ? `?${sp}` : ""));
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 12px",
                  background: isActive ? "#f3f9fe" : "transparent",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#080707",
                }}
              >
                <span style={{ flex: 1 }}>{v.label}</span>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "#1589ee" }}>
                    <path d="M5 10.5L2 7.5l1-1L5 8.5 11 2.5l1 1z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" | null }) {
  const upColor = active && dir === "asc" ? "#0070d2" : "#aeaeae";
  const downColor = active && dir === "desc" ? "#0070d2" : "#aeaeae";
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M5 0l4 5H1z" fill={upColor} />
      <path d="M5 14L1 9h8z" fill={downColor} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Util: derive an "alias" from an email or name                      */
/* ------------------------------------------------------------------ */

export function ownerAlias(user: { name?: string | null; email?: string | null } | null): string {
  if (!user) return "";
  if (user.email) {
    const local = user.email.split("@")[0];
    return local.toLowerCase().slice(0, 8);
  }
  if (user.name) {
    return user.name.replace(/\s+/g, "").toLowerCase().slice(0, 8);
  }
  return "";
}
