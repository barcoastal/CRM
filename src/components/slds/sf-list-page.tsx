import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  SfListSearch,
  SfRowCheckbox,
  SfSelectAllCheckbox,
  SfSelectionProvider,
  SfMassActionsToolbar,
  SfViewPicker,
  SfRowTr,
  type SfMassToolbarConfig,
  type SfViewOption,
} from "./sf-list-client";

/* ------------------------------------------------------------------ */
/* SF Lightning list page — server component                          */
/*                                                                    */
/* Server component. Takes only serializable props. Interactive bits  */
/* (search box, sort header links, checkboxes, mass-action toolbar,   */
/* view picker, clickable rows) are client-component islands which    */
/* share state via React Context (SfSelectionProvider).               */
/* ------------------------------------------------------------------ */

export interface SfColumn {
  /** stable key — also used as `?sort=` URL param value */
  key: string;
  /** header label as it appears in SF */
  label: string;
  /** fixed column width in px */
  width?: number;
  /** if true, render the sort arrows + wrap header in a link to `?sort=key&dir=...` */
  sortable?: boolean;
  /** right-align numeric columns */
  align?: "left" | "right";
}

export interface SfRow {
  id: string;
  /** href the primary (first) column wraps in */
  href?: string;
  /** pre-rendered cell contents, one per column */
  cells: ReactNode[];
}

export interface SfListAction {
  label: string;
  href?: string;
}

export interface SfListPageProps {
  /** entity slug (e.g. "lead", "opportunity", "account", "contact") */
  entity: string;
  /** plural title, e.g. "Leads" */
  title: string;
  /** subtitle like "Recently Viewed" — appears as the big bold label */
  subtitle: string;
  /** total items count */
  count: number;
  /** background hex for the icon tile (e.g. "#f88962" for Lead orange) */
  iconColor?: string;
  /** SLDS standard icon slug, e.g. "lead", "opportunity" */
  iconSlug: string;
  /** right-aligned header action buttons */
  actions: SfListAction[];
  /** the columns */
  columns: SfColumn[];
  /** the rows (pre-rendered cells) */
  rows: SfRow[];
  /** current pathname (for sort link hrefs) */
  pathname: string;
  /** current sort key from URL */
  sortKey?: string;
  /** current sort dir from URL ("asc" | "desc") */
  sortDir?: "asc" | "desc";
  /** current search query from URL */
  searchQuery?: string;
  /** preserved query params (everything except sort/dir/search) */
  preservedParams?: Record<string, string>;
  /** mass action toolbar config (statuses + which API to hit) */
  massConfig: SfMassToolbarConfig;
  /** list view options for the title dropdown picker */
  views?: SfViewOption[];
  /** current selected view value (matches ?view=) */
  currentView?: string;
  /** 1-based current page (for pagination) */
  page?: number;
  /** rows per page (for pagination) */
  pageSize?: number;
}

export function SfListPage(props: SfListPageProps) {
  const {
    title,
    subtitle,
    count,
    iconColor,
    iconSlug,
    actions,
    columns,
    rows,
    pathname,
    sortKey,
    sortDir,
    searchQuery,
    preservedParams,
    massConfig,
    views,
    currentView,
    page,
    pageSize,
  } = props;

  const ids = rows.map((r) => r.id);

  // Pagination (only when page + pageSize are provided)
  const pageNum = page && page > 0 ? page : 1;
  const size = pageSize && pageSize > 0 ? pageSize : 0;
  const totalPages = size > 0 ? Math.max(1, Math.ceil(count / size)) : 1;
  const showPager = size > 0 && totalPages > 1;
  const startIdx = count === 0 ? 0 : (pageNum - 1) * size + 1;
  const endIdx = Math.min(pageNum * size, count);
  const pageHref = (p: number) =>
    buildHref(pathname, preservedParams, {
      search: searchQuery || undefined,
      sort: sortKey || undefined,
      dir: sortKey ? sortDir : undefined,
      page: p > 1 ? String(p) : undefined,
    });

  return (
    <SfSelectionProvider ids={ids}>
      <div style={{ padding: 0 }}>
        <SfMassActionsToolbar config={massConfig} />
        <Header
          iconSlug={iconSlug}
          iconColor={iconColor}
          title={title}
          subtitle={subtitle}
          count={count}
          actions={actions}
          searchQuery={searchQuery ?? ""}
          pathname={pathname}
          preservedParams={preservedParams ?? {}}
          views={views}
          currentView={currentView}
        />

        <div
          style={{
            background: "#fff",
            border: "1px solid #c9c9c9",
            borderTop: "none",
            overflowX: "auto",
          }}
        >
          <table
            className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover"
            role="grid"
            style={{
              tableLayout: "fixed",
              width: "100%",
              fontSize: 12,
              borderCollapse: "collapse",
              fontFamily:
                "'Salesforce Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 44 }} />
              {columns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
              <col style={{ width: 32 }} />
            </colgroup>
            <thead>
              <tr className="slds-line-height_reset">
                <th
                  scope="col"
                  style={{
                    padding: "0 6px",
                    background: "#fafaf9",
                    borderBottom: "1px solid #c9c9c9",
                    borderRight: "1px solid #c9c9c9",
                    textAlign: "center",
                  }}
                >
                  <SfSelectAllCheckbox />
                </th>
                <th
                  scope="col"
                  style={{
                    background: "#fafaf9",
                    borderBottom: "1px solid #c9c9c9",
                    borderRight: "1px solid #c9c9c9",
                    padding: "6px 8px",
                    textAlign: "left",
                    color: "#444444",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
                {columns.map((c) => {
                  const isSorted = sortKey === c.key;
                  const dir = isSorted ? sortDir ?? "asc" : null;
                  const nextDir = isSorted && sortDir === "asc" ? "desc" : "asc";
                  const sortHref = buildHref(pathname, preservedParams, {
                    sort: c.key,
                    dir: nextDir,
                    search: searchQuery,
                  });
                  const headerInner = (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 8px",
                        color: "#181818",
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                        justifyContent:
                          c.align === "right" ? "flex-end" : "flex-start",
                      }}
                    >
                      <span
                        className="slds-truncate"
                        title={c.label}
                        style={{
                          flex: 1,
                          textAlign: c.align === "right" ? "right" : "left",
                        }}
                      >
                        {c.label}
                      </span>
                      {c.sortable && <SortIcon dir={dir} />}
                      <DownChev />
                    </span>
                  );
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      style={{
                        background: "#fafaf9",
                        borderBottom: "1px solid #c9c9c9",
                        borderRight: "1px solid #c9c9c9",
                        padding: 0,
                        textAlign: c.align === "right" ? "right" : "left",
                      }}
                    >
                      {c.sortable ? (
                        <Link
                          href={sortHref}
                          scroll={false}
                          style={{
                            display: "block",
                            textDecoration: "none",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          {headerInner}
                        </Link>
                      ) : (
                        headerInner
                      )}
                    </th>
                  );
                })}
                <th
                  scope="col"
                  style={{
                    background: "#fafaf9",
                    borderBottom: "1px solid #c9c9c9",
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    style={{
                      textAlign: "center",
                      padding: 48,
                      color: "#747474",
                      fontSize: 13,
                    }}
                  >
                    No records to display.
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => (
                <SfRowTr key={row.id} id={row.id} href={row.href}>
                  <td
                    role="gridcell"
                    style={{
                      padding: "0 6px",
                      borderBottom: "1px solid #f3f2f2",
                      borderRight: "1px solid #f3f2f2",
                      textAlign: "center",
                    }}
                  >
                    <SfRowCheckbox id={row.id} rowIndex={idx + 1} />
                  </td>
                  <td
                    role="gridcell"
                    style={{
                      padding: "6px 8px",
                      fontSize: 12,
                      color: "#444444",
                      borderBottom: "1px solid #f3f2f2",
                      borderRight: "1px solid #f3f2f2",
                    }}
                  >
                    {idx + 1}
                  </td>
                  {columns.map((c, ci) => {
                    const isPrimary = ci === 0;
                    return (
                      <td
                        key={c.key}
                        role="gridcell"
                        style={{
                          padding: "6px 8px",
                          fontSize: 12,
                          color: "#181818",
                          borderBottom: "1px solid #f3f2f2",
                          borderRight: "1px solid #f3f2f2",
                          textAlign: c.align === "right" ? "right" : "left",
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
                          {isPrimary && row.href ? (
                            <Link
                              href={row.href}
                              style={{
                                color: "#0176d3",
                                textDecoration: "none",
                              }}
                              className="sf-row-link"
                            >
                              {row.cells[ci]}
                            </Link>
                          ) : (
                            row.cells[ci]
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
                    <DownChev />
                  </td>
                </SfRowTr>
              ))}
            </tbody>
          </table>
        </div>

        {showPager && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 16px",
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderTop: "none",
              fontSize: 13,
              color: "#444444",
            }}
          >
            <span>
              {startIdx}–{endIdx} of {count} · Page {pageNum} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <PagerLink href={pageHref(pageNum - 1)} disabled={pageNum <= 1} label="‹ Previous" />
              <PagerLink href={pageHref(pageNum + 1)} disabled={pageNum >= totalPages} label="Next ›" />
            </div>
          </div>
        )}

        <style>{`
          .sf-row-link:hover { text-decoration: underline; }
          .sf-row:hover { background: #f4f6f9 !important; }
        `}</style>
      </div>
    </SfSelectionProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  iconSlug,
  iconColor,
  title,
  subtitle,
  count,
  actions,
  searchQuery,
  pathname,
  preservedParams,
  views,
  currentView,
}: {
  iconSlug: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  count: number;
  actions: SfListAction[];
  searchQuery: string;
  pathname: string;
  preservedParams: Record<string, string>;
  views?: SfViewOption[];
  currentView?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
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
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: "#fff" }}>
              <use
                xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${iconSlug}`}
              />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.2 }}>
              {title}
            </div>
            {views && views.length > 0 ? (
              <SfViewPicker views={views} current={currentView ?? "recent"} />
            ) : (
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#181818",
                  lineHeight: 1.2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {subtitle}
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: "#181818" }}>
                  <path d="M2 4l4 4 4-4z" />
                </svg>
              </div>
            )}
            <div style={{ marginTop: 2, fontSize: 12, color: "#444444" }}>
              {count} item{count === 1 ? "" : "s"}
              <span style={{ color: "#747474" }}> · Updated a few seconds ago</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 0,
            flexShrink: 0,
            border: "1px solid #c9c9c9",
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
                  color: "#0176d3",
                  fontSize: 13,
                  fontWeight: 400,
                  cursor: "pointer",
                  borderRight:
                    i < actions.length - 1 ? "1px solid #c9c9c9" : "none",
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
              <span key={a.label} style={{ textDecoration: "none" }}>
                {inner}
              </span>
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
        <SfListSearch
          pathname={pathname}
          preservedParams={preservedParams}
          initialValue={searchQuery}
        />
        <IconBtn ariaLabel="List controls">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.3-2.4h-4l-.3 2.4a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.4h4l.3-2.4a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Choose view">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
            <rect x="3" y="4" width="18" height="3" />
            <rect x="3" y="10" width="18" height="3" />
            <rect x="3" y="16" width="18" height="3" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
            <path d="M17.65 6.35A8 8 0 0 0 4 12h2a6 6 0 0 1 10.24-4.24L13 11h7V4l-2.35 2.35z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Sort">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
            <path d="M7 4l-4 5h3v11h2V9h3L7 4zm10 16l4-5h-3V4h-2v11h-3l4 5z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Edit list">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </IconBtn>
        <IconBtn ariaLabel="Filters">
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
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
  children: ReactNode;
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
        border: "1px solid #c9c9c9",
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

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  const upColor = dir === "asc" ? "#0176d3" : "#aeaeae";
  const downColor = dir === "desc" ? "#0176d3" : "#aeaeae";
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 10 14"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M5 0l4 5H1z" fill={upColor} />
      <path d="M5 14L1 9h8z" fill={downColor} />
    </svg>
  );
}

function DownChev() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      style={{ fill: "#747474", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M2 4l4 4 4-4z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 12px",
    border: "1px solid #c9c9c9",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  };
  if (disabled) {
    return <span style={{ ...style, color: "#c9c7c5", background: "#f3f3f3", cursor: "not-allowed" }}>{label}</span>;
  }
  return (
    <Link href={href} style={{ ...style, color: "#0176d3", background: "#fff" }}>
      {label}
    </Link>
  );
}

function buildHref(
  pathname: string,
  preserved: Record<string, string> | undefined,
  next: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  if (preserved) {
    for (const [k, v] of Object.entries(preserved)) {
      if (v) sp.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(next)) {
    if (v && v.length > 0) {
      sp.set(k, v);
    } else {
      sp.delete(k);
    }
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/* ------------------------------------------------------------------ */
/* Util: derive an "alias" from an email or name (8 chars, lowercase) */
/* ------------------------------------------------------------------ */

export function ownerAlias(
  user: { name?: string | null; email?: string | null } | null,
): string {
  if (!user) return "";
  if (user.email) {
    return user.email.split("@")[0].toLowerCase().slice(0, 8);
  }
  if (user.name) {
    return user.name.replace(/\s+/g, "").toLowerCase().slice(0, 8);
  }
  return "";
}
