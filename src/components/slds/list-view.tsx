import Link from "next/link";
import type { ReactNode } from "react";
import { ViewPicker, type ListViewOption } from "./view-picker";

export interface ListViewColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

/**
 * SF Lightning list view — canonical SLDS markup so the SLDS CSS
 * (.slds-card, .slds-table_bordered, .slds-cell-edit, etc.) styles
 * everything natively.
 */
export function ListView<T extends { id: string }>({
  entity,
  entityLabel,
  viewName = `Recently Viewed`,
  totalCount,
  rows,
  columns,
  rowHref,
  newHref,
  iconHref,
  views,
}: {
  entity: string;
  entityLabel?: string;
  viewName?: string;
  totalCount: number;
  rows: T[];
  columns: ListViewColumn<T>[];
  rowHref?: (row: T) => string;
  newHref?: string;
  iconHref?: string;  // direct SLDS sprite path override
  views?: ListViewOption[]; // when provided, renders the view picker
}) {
  return (
    <article className="slds-card">
      {/* Card header — matches SF list-view header */}
      <div className="slds-card__header slds-grid slds-grid_vertical-align-center">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__figure">
            <span className={`slds-icon_container slds-icon-standard-${slugEntity(entity)}`} title={entityLabel ?? entity}>
              <svg className="slds-icon slds-icon_small" aria-hidden="true">
                <use xlinkHref={iconHref ?? `/slds/icons/standard-sprite/svg/symbols.svg#${slugEntity(entity)}`} />
              </svg>
              <span className="slds-assistive-text">{entityLabel ?? entity}</span>
            </span>
          </div>
          <div className="slds-media__body">
            <div className="slds-text-color_weak slds-text-body_small">{entityLabel ?? entity}s</div>
            <h2 className="slds-card__header-title">
              {views ? (
                <ViewPicker views={views} currentName={viewName} entity={entity} />
              ) : (
                <span className="slds-text-heading_medium" style={{ fontWeight: 700, color: "#080707" }}>
                  {viewName}
                </span>
              )}
            </h2>
            <div className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
              {totalCount} item{totalCount === 1 ? "" : "s"} · Updated a few seconds ago
            </div>
          </div>
        </header>
        <div className="slds-no-flex">
          {newHref && (
            <Link href={newHref} className="slds-button slds-button_neutral">
              New
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="slds-card__body slds-card__body_inner" style={{ padding: 0 }}>
        <table
          className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped"
          role="grid"
        >
          <thead>
            <tr className="slds-line-height_reset">
              {columns.map((c) => (
                <th key={c.key} scope="col">
                  <div className="slds-truncate slds-text-title_caps" title={c.label}>
                    {c.label}
                  </div>
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
                <tr key={row.id} className="slds-hint-parent">
                  {columns.map((c, ci) => (
                    <td key={c.key} role="gridcell">
                      <div className="slds-truncate" title={typeof c.render === "function" ? "" : ""}>
                        {ci === 0 && href ? (
                          <Link
                            href={href}
                            style={{ color: "#0070d2", textDecoration: "none", fontWeight: 400 }}
                          >
                            {c.render(row)}
                          </Link>
                        ) : (
                          c.render(row)
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function slugEntity(entity: string): string {
  // Maps Entity → SLDS icon name (lowercase, _-separated)
  const map: Record<string, string> = {
    Account: "account",
    Contact: "contact",
    Lead: "lead",
    Opportunity: "opportunity",
    Client: "household",
    Creditor: "partners",
    Case: "case",
    ProgramPlan: "service_contract",
    Draft: "invoice",
    Offer: "quotes",
    Settlement: "agent_session",
    Fee: "currency",
    Task: "task",
    Event: "event",
    Email: "email",
    Sms: "sms",
    Campaign: "campaign",
    User: "user",
  };
  return map[entity] ?? "default";
}
