import Link from "next/link";
import type { ReactNode } from "react";

export function RelatedList<T extends { id: string }>({
  entity,
  title,
  items,
  renderItem,
  emptyHint = "Nothing to show",
  newHref,
  viewAllHref,
  header,
}: {
  entity: string;
  title: string;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  emptyHint?: string;
  newHref?: string;
  viewAllHref?: string;
  /** Optional column-header row rendered above the items (SF table-style lists). */
  header?: ReactNode;
}) {
  const slug = slugEntity(entity);
  return (
    <article className="slds-card slds-m-bottom_small">
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__figure">
            <span className={`slds-icon_container slds-icon-standard-${slug}`} title={entity}>
              <svg className="slds-icon slds-icon_small" aria-hidden="true">
                <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${slug}`} />
              </svg>
            </span>
          </div>
          <div className="slds-media__body">
            <h2 className="slds-card__header-title">
              <span className="slds-text-heading_small" style={{ fontWeight: 700 }}>
                {title} ({items.length})
              </span>
            </h2>
          </div>
        </header>
        <div className="slds-no-flex">
          {newHref && (
            <Link href={newHref} className="slds-button slds-button_neutral slds-button_small">
              New
            </Link>
          )}
        </div>
      </div>

      <div className="slds-card__body">
        {items.length === 0 ? (
          <div className="slds-p-around_medium slds-text-color_weak slds-text-body_small">
            {emptyHint}
          </div>
        ) : (
          <ul>
            {header && (
              <li className="slds-p-around_small" style={{ borderBottom: "1px solid #e5e5e5", background: "#fafaf9" }}>
                {header}
              </li>
            )}
            {items.map((item) => (
              <li
                key={item.id}
                className="slds-p-around_small"
                style={{ borderBottom: "1px solid #f3f3f3", fontSize: 13 }}
              >
                {renderItem(item)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewAllHref && items.length > 0 && (
        <footer className="slds-card__footer">
          <Link href={viewAllHref} className="slds-text-link">
            View All
          </Link>
        </footer>
      )}
    </article>
  );
}

function slugEntity(entity: string): string {
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
