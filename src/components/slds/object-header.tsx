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
    <div
      className="slds-page-header slds-page-header_record-home"
      style={{
        background: "#f3f3f3",
        border: "1px solid #d8dde6",
        borderRadius: "4px 4px 0 0",
        padding: "12px 16px 0",
      }}
    >
      <div className="slds-page-header__row" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="slds-page-header__col-title" style={{ flex: 1, minWidth: 0 }}>
          <div className="slds-media" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div className="slds-media__figure" style={{ flexShrink: 0 }}>
              <span
                className={`slds-icon_container slds-icon-standard-${slug}`}
                title={entityLabel ?? entity}
                style={{
                  background: "#fcb95b",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                }}
              >
                <svg className="slds-icon slds-page-header__icon" aria-hidden="true" style={{ width: 20, height: 20, fill: "#fff" }}>
                  <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${slug}`} />
                </svg>
              </span>
            </div>
            <div className="slds-media__body" style={{ minWidth: 0 }}>
              <div className="slds-page-header__name">
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "#3e3e3c",
                    fontWeight: 400,
                    lineHeight: 1.2,
                  }}
                >
                  {entityLabel ?? entity}
                </span>
                <h1 style={{ margin: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#080707",
                      lineHeight: 1.3,
                    }}
                  >
                    {recordTitle}
                  </span>
                </h1>
              </div>
              {recordSubtitle && (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "#3e3e3c",
                    lineHeight: 1.3,
                  }}
                >
                  {recordSubtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && (
          <div className="slds-page-header__col-actions" style={{ flexShrink: 0 }}>
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {actions}
              </div>
            </div>
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <div
          className="slds-page-header__row slds-page-header__row_gutters"
          style={{
            marginTop: 10,
            paddingTop: 10,
            paddingBottom: 8,
            borderTop: "1px solid #ecebea",
          }}
        >
          <ul
            className="slds-page-header__detail-row"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${highlights.length}, 1fr)`,
              gap: 0,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {highlights.map((h, i) => (
              <li
                key={i}
                className="slds-page-header__detail-block"
                style={{
                  padding: "0 12px",
                  borderLeft: i === 0 ? "none" : "1px solid #dddbda",
                  minWidth: 0,
                }}
              >
                <div
                  className="slds-text-title slds-truncate"
                  title={h.label}
                  style={{
                    fontSize: 11,
                    color: "#3e3e3c",
                    fontWeight: 400,
                    lineHeight: 1.4,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h.label}
                </div>
                <div
                  className="slds-text-body_regular slds-truncate"
                  style={{
                    fontSize: 13,
                    color: "#080707",
                    fontWeight: 400,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h.value ?? "—"}
                </div>
              </li>
            ))}
          </ul>
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
