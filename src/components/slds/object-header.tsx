import { ObjectIcon, UtilityIcon } from "./icon";
import type { ReactNode } from "react";

export interface ObjectHeaderField {
  label: string;
  value: ReactNode;
}

/**
 * SLDS record-page header. Renders the colored object icon + entity name +
 * record title, a row of "highlights" (key fields displayed inline) and an
 * action buttons strip on the right.
 *
 * Matches the SF Lightning Experience pattern exactly.
 */
export function ObjectHeader({
  entity,
  entityLabel,
  recordTitle,
  recordSubtitle,
  highlights = [],
  actions,
}: {
  entity: string;            // "Account" → drives icon
  entityLabel?: string;      // "Account" — text under icon
  recordTitle: string;       // "Acme Construction LLC"
  recordSubtitle?: ReactNode;
  highlights?: ObjectHeaderField[];
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 4,
        border: "1px solid #d8dde6",
        padding: "12px 16px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <ObjectIcon entity={entity} size="large" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#3e3e3c", fontWeight: 400 }}>{entityLabel ?? entity}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#080707", marginTop: 2 }}>
            {recordTitle}
          </div>
          {recordSubtitle && (
            <div style={{ fontSize: 12, color: "#3e3e3c", marginTop: 4 }}>{recordSubtitle}</div>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div>
        )}
      </div>

      {highlights.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid #ecebea",
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(highlights.length, 5)}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {highlights.map((h, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400 }}>{h.label}</div>
              <div
                style={{
                  fontSize: 13,
                  color: "#080707",
                  fontWeight: 600,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {h.value ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SF-style detail tab navigation (sits below ObjectHeader on record pages).
 */
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
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid #d8dde6",
        background: "#fff",
        padding: "0 16px",
        gap: 4,
      }}
    >
      {tabs.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            onClick={() => onChange?.(t.id)}
            style={{
              background: "transparent",
              border: 0,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: active ? 700 : 400,
              color: active ? "#16325c" : "#3e3e3c",
              borderBottom: active ? "3px solid #1589ee" : "3px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span style={{ color: "#706e6b", fontWeight: 400, marginLeft: 6 }}>
                ({t.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
