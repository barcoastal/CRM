import type { ReactNode } from "react";

export interface ObjectHeaderField {
  label: string;
  value: ReactNode;
}

/**
 * SLDS canonical Page Header for record pages.
 * Renders the exact .slds-page-header markup so SLDS CSS handles it natively.
 */
export function ObjectHeader({
  entity,
  entityLabel,
  recordTitle,
  recordSubtitle,
  highlights = [],
  actions,
}: {
  entity: string;
  entityLabel?: string;
  recordTitle: string;
  recordSubtitle?: ReactNode;
  highlights?: ObjectHeaderField[];
  actions?: ReactNode;
}) {
  const slug = slugEntity(entity);
  return (
    <div className="slds-page-header slds-page-header_record-home">
      <div className="slds-page-header__row">
        <div className="slds-page-header__col-title">
          <div className="slds-media">
            <div className="slds-media__figure">
              <span className={`slds-icon_container slds-icon-standard-${slug}`} title={entityLabel ?? entity}>
                <svg className="slds-icon slds-page-header__icon" aria-hidden="true">
                  <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${slug}`} />
                </svg>
              </span>
            </div>
            <div className="slds-media__body">
              <div className="slds-page-header__name">
                <div className="slds-page-header__name-title">
                  <h1>
                    <span className="slds-page-header__title slds-truncate" style={{ display: "block" }}>
                      <span className="slds-text-body_regular slds-text-color_weak" style={{ display: "block", fontSize: 12 }}>
                        {entityLabel ?? entity}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#080707" }}>
                        {recordTitle}
                      </span>
                    </span>
                  </h1>
                </div>
              </div>
              {recordSubtitle && (
                <p className="slds-page-header__name-meta slds-text-body_small slds-text-color_weak">
                  {recordSubtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && (
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control" style={{ display: "flex", gap: 4 }}>
                {actions}
              </div>
            </div>
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <div className="slds-page-header__row slds-page-header__row_gutters">
          <div className="slds-page-header__col-details">
            <ul className="slds-page-header__detail-row">
              {highlights.map((h, i) => (
                <li key={i} className="slds-page-header__detail-block">
                  <div className="slds-text-title slds-truncate" title={h.label}>{h.label}</div>
                  <div className="slds-text-body_regular slds-truncate" style={{ fontWeight: 600 }}>
                    {h.value ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function DetailTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange?: (id: string) => void;
}) {
  return (
    <div className="slds-tabs_default">
      <ul className="slds-tabs_default__nav" role="tablist">
        {tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <li
              key={t.id}
              className={`slds-tabs_default__item ${active ? "slds-is-active" : ""}`}
              role="presentation"
            >
              <a
                className="slds-tabs_default__link"
                href={`#${t.id}`}
                role="tab"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                onClick={(e) => {
                  e.preventDefault();
                  onChange?.(t.id);
                }}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="slds-text-color_weak slds-p-left_xx-small">({t.count})</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
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
