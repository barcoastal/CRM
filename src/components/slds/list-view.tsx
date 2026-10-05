import type { ReactNode } from "react";
import { ViewPicker, type ListViewOption } from "./view-picker";
import { ListSelectionProvider } from "@/components/lists/list-table-wrapper";
import { ListRowCheckbox, ListSelectAllCheckbox } from "@/components/lists/list-checkbox-cell";
import { RecordLinkCell } from "@/components/lists/record-link-cell";
import { LightningListHeader } from "./lightning-list-header";
import styles from "./lightning-list.module.css";

export interface ListViewColumn<T> {
  key: string;
  label: string;
  width?: number;
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
  selectable,
  bulkBar,
  toolbar,
  footer,
  rowOffset = 0,
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
  /** when true, the leftmost column is a selection checkbox + header all-toggle */
  selectable?: boolean;
  /** rendered above the table when selectable + the BulkActionBar is needed */
  bulkBar?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  rowOffset?: number;
}) {
  const ids = rows.map((r) => r.id);
  const inner = (
    <article className={styles.list} data-crm-list data-salesforce-list>
      <LightningListHeader
        title={entityLabel ?? `${entity}s`}
        subtitle={viewName}
        iconSlug={slugEntity(entity)}
        iconHref={iconHref}
        count={totalCount}
        countLabel={totalCount.toLocaleString("en-US")}
        actions={newHref ? [{ label: "New", href: newHref }] : []}
        viewPicker={views ? <ViewPicker views={views} currentName={viewName} entity={entity} /> : undefined}
        searchControl={toolbar}
      />

      {/* Table */}
      {selectable && bulkBar}
      <div className={styles.viewport}>
        <table
          className={`slds-table slds-table_cell-buffer slds-table_bordered ${styles.grid}`}
          role="grid"
          style={{ tableLayout: "fixed", width: "100%", minWidth: columns.reduce((width, c, i) => width + (c.width ?? (i === 0 ? 240 : 160)), 82), borderCollapse: "collapse" }}
        >
          <colgroup>
            <col style={{ width: 46 }} /><col style={{ width: 36 }} />
            {columns.map((c, i) => <col key={c.key} style={{ width: c.width ?? (i === 0 ? 240 : 160) }} />)}
          </colgroup>
          <thead>
            <tr className="slds-line-height_reset">
              <th scope="col"><span className="slds-assistive-text">Row</span></th>
              <th scope="col">{selectable && <ListSelectAllCheckbox />}</th>
              {columns.map((c) => (
                <th key={c.key} scope="col" style={{ padding: 0, borderRight: "1px solid #c9c9c9" }}>
                  <span className={styles.columnTitle} title={c.label}>
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className={styles.empty}>
                  No records match.
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const href = rowHref?.(row);
              return (
                <tr key={row.id} className="slds-hint-parent">
                  <td role="gridcell">{rowOffset + index + 1}</td>
                  <td role="gridcell">{selectable && <ListRowCheckbox id={row.id} />}</td>
                  {columns.map((c, ci) => (
                    <td key={c.key} role="gridcell">
                      <div className="slds-truncate" title={typeof c.render === "function" ? "" : ""}>
                        {ci === 0 && href ? (
                          <RecordLinkCell href={href}>
                            {c.render(row)}
                          </RecordLinkCell>
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
        {footer && <div className={styles.pager}>{footer}</div>}
      </div>
    </article>
  );
  if (!selectable) return inner;
  return <ListSelectionProvider ids={ids}>{inner}</ListSelectionProvider>;
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
    Draft: "record",
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
