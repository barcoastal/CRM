"use client";

import { useState, type ReactNode } from "react";

export type AccountTabKey =
  | "Details"
  | "Payment Calculator"
  | "Activities"
  | "Documents"
  | "Related Records"
  | "Debt Info"
  | "Opportunities"
  | "Team"
  | "Marketing"
  | "All SF Fields";

// Account record page tab order: Details | Payment Calculator | Activities |
// Documents | Related Records | Debt Info | More. Details is the default.
// "Debt Info" replaced the old "Payment Summaries" tab - it mirrors the
// Opportunity debt details (enrolled creditors, payment amount + frequency,
// cumulative weekly obligation). "All SF Fields" is reachable via a footer
// link on the Details tab.
const PRIMARY_TABS: AccountTabKey[] = [
  "Details",
  "Payment Calculator",
  "Activities",
  "Documents",
  "Related Records",
  "Debt Info",
];
const MORE_TABS: AccountTabKey[] = [
  "Opportunities",
  "Team",
  "Marketing",
];
const TABS: AccountTabKey[] = [...PRIMARY_TABS, ...MORE_TABS];

// SF's Debt Settlement app labels this tab "Related Records" verbatim.
const TAB_LABEL: Partial<Record<AccountTabKey, string>> = {};

export function AccountTabs({ panels }: { panels: Record<AccountTabKey, ReactNode> }) {
  const [tab, setTab] = useState<AccountTabKey>("Details");
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
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: 0,
                padding: "8px 16px",
                fontSize: 16,
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
