"use client";

import { useState, type ReactNode } from "react";

export type AccountTabKey =
  | "Details"
  | "Payment Calculator"
  | "Activities"
  | "Documents"
  | "Related Records"
  | "Payment Summaries"
  | "Settlements"
  | "Opportunities"
  | "Contacts"
  | "Team"
  | "Marketing"
  | "All SF Fields";

// SF Lightning Account record page tab order (verified against the live org):
// Related | Details | Opportunities, Related is the default tab. Our extra
// CRM tabs follow, with the least-used ones in the More overflow.
// "All SF Fields" is intentionally NOT in the tab strip; it's reachable via
// a footer link on the Details tab.
const PRIMARY_TABS: AccountTabKey[] = [
  "Related Records",
  "Details",
  "Opportunities",
  "Payment Calculator",
  "Activities",
  "Documents",
];
const MORE_TABS: AccountTabKey[] = [
  "Payment Summaries",
  "Settlements",
  "Contacts",
  "Team",
  "Marketing",
];
const TABS: AccountTabKey[] = [...PRIMARY_TABS, ...MORE_TABS];

// SF labels the tab "Related".
const TAB_LABEL: Partial<Record<AccountTabKey, string>> = { "Related Records": "Related" };

export function AccountTabs({ panels }: { panels: Record<AccountTabKey, ReactNode> }) {
  const [tab, setTab] = useState<AccountTabKey>("Related Records");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_TABS.includes(tab);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#fff",
          borderBottom: "1px solid #c9c9c9",
          padding: "0 12px",
          overflowX: "auto",
        }}
      >
        {PRIMARY_TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setMoreOpen(false);
              }}
              style={{
                background: "transparent",
                border: 0,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#181818" : "#444444",
                borderBottom: active ? "3px solid #0176d3" : "3px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {TAB_LABEL[t] ?? t}
            </button>
          );
        })}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMoreOpen((o) => !o)}
            style={{
              background: "transparent",
              border: 0,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: moreActive ? 700 : 400,
              color: moreActive ? "#181818" : "#444444",
              borderBottom: moreActive ? "3px solid #0176d3" : "3px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {moreActive ? (TAB_LABEL[tab] ?? tab) : "More"}
            <svg width="9" height="9" viewBox="0 0 10 10" style={{ fill: "currentColor" }}>
              <path d="M0 2l5 6 5-6z" />
            </svg>
          </button>
          {moreOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                background: "#fff",
                border: "1px solid #c9c9c9",
                borderRadius: 4,
                boxShadow: "0 2px 4px 0 rgba(0,0,0,.16)",
                minWidth: 180,
                zIndex: 10,
                padding: "4px 0",
              }}
            >
              {MORE_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setMoreOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    padding: "8px 16px",
                    fontSize: 13,
                    color: "#181818",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f2f2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {panels[tab]}
        {tab === "Details" && (
          <div
            style={{
              padding: "6px 0 0",
              fontSize: 12,
              textAlign: "right",
            }}
          >
            <button
              type="button"
              onClick={() => setTab("All SF Fields")}
              style={{
                background: "transparent",
                border: 0,
                color: "#0176d3",
                cursor: "pointer",
                padding: 0,
                fontSize: 12,
              }}
            >
              Show all SF fields
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
