import Link from "next/link";
import type { ReactNode } from "react";
import { ObjectIcon, UtilityIcon } from "./icon";

export interface ListViewColumn<T> {
  key: string;
  label: string;
  width?: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
}

/**
 * SLDS list-view shell: object header strip (icon + entity + view picker +
 * action buttons) and a data table with hover rows.
 */
export function ListView<T extends { id: string }>({
  entity,
  entityLabel,
  viewName = `All ${entityLabel ?? entity}s`,
  totalCount,
  rows,
  columns,
  rowHref,
  newHref,
  actions,
}: {
  entity: string;
  entityLabel?: string;
  viewName?: string;
  totalCount: number;
  rows: T[];
  columns: ListViewColumn<T>[];
  rowHref?: (row: T) => string;
  newHref?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 4,
        border: "1px solid #d8dde6",
        overflow: "hidden",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          gap: 12,
          borderBottom: "1px solid #d8dde6",
          background: "#fafaf9",
        }}
      >
        <ObjectIcon entity={entity} size="medium" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#706e6b" }}>{entityLabel ?? entity}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#080707", display: "inline-flex", gap: 4, alignItems: "center" }}>
            {viewName}
            <UtilityIcon name="down" size={14} />
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#706e6b", marginRight: 8 }}>
            {totalCount} item{totalCount === 1 ? "" : "s"}
          </span>
          <IconButton title="Refresh" icon="refresh" />
          <IconButton title="List View Settings" icon="settings" />
          <IconButton title="Display as Split View" icon="rows" />
          {actions}
          {newHref && (
            <Link
              href={newHref}
              style={{
                marginLeft: 8,
                background: "#1589ee",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              New
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d8dde6", background: "#fafaf9" }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 11,
                    color: "#3e3e3c",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    width: c.width,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: 40, color: "#706e6b" }}>
                  No records match.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: "1px solid #f3f3f3",
                  }}
                >
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "10px 12px",
                        color: "#080707",
                        verticalAlign: "middle",
                      }}
                    >
                      {ci === 0 && href ? (
                        <Link href={href} style={{ color: "#1589ee", textDecoration: "none", fontWeight: 600 }}>
                          {c.render(row)}
                        </Link>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconButton({ title, icon }: { title: string; icon: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      style={{
        background: "transparent",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <UtilityIcon name={icon} size={14} />
    </button>
  );
}
