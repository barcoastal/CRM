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
      style={{
        background: "#f3f3f3",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        // Measured from the live org: .slds-page-header padding is 8px 12px.
        padding: "8px 12px 0",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0 }}>
              <span
                title={entityLabel ?? entity}
                style={{
                  background: ENTITY_COLOR[slug] ?? "#fcb95b",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                }}
              >
                <svg aria-hidden="true" style={{ width: 20, height: 20, fill: "#fff" }}>
                  <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${slug}`} />
                </svg>
              </span>
            </div>
            <div className="slds-media__body" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "#444444",
                    fontWeight: 400,
                    lineHeight: 1.2,
                    marginBottom: 1,
                  }}
                >
                  {entityLabel ?? entity}
                </span>
                <h1 style={{ margin: 0, display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#181818",
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
                    color: "#444444",
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
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {actions}
            </div>
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            paddingBottom: 6,
            borderTop: "1px solid #e5e5e5",
          }}
        >
          <ul
            style={{
              // SF packs highlight fields to the LEFT at content width with a
              // fixed gutter; they do not spread across the full header width.
              display: "flex",
              justifyContent: "flex-start",
              columnGap: 48,
              listStyle: "none",
              margin: 0,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {highlights.map((h, i) => (
              <li
                key={i}
                style={{
                  // SF's highlights strip has no vertical dividers.
                  minWidth: 0,
                  maxWidth: 220,
                  flex: "0 1 auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  title={h.label}
                  style={{
                    fontSize: 11,
                    color: "#444444",
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
                  style={{
                    fontSize: 13,
                    color: "#181818",
                    fontWeight: 400,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h.value ?? ""}
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

// SF Lightning standard-icon brand colors per object.
const ENTITY_COLOR: Record<string, string> = {
  account: "#7f8de1",
  contact: "#a094ed",
  lead: "#f88962",
  opportunity: "#ff9a3c",
  case: "#f2cf5b",
  household: "#26c8b3",
  partners: "#56aadc",
  task: "#4bc076",
  event: "#bfb6e8",
  email: "#95aec5",
  sms: "#56aadc",
};

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
