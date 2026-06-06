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

// SF tab bar order — exactly matches Lightning Account record page.
// "All SF Fields" is intentionally NOT in the tab strip; it's reachable via
// a footer link on the Details tab.
const TABS: AccountTabKey[] = [
  "Details",
  "Payment Calculator",
  "Activities",
  "Documents",
  "Related Records",
  "Payment Summaries",
  "Settlements",
  "Opportunities",
  "Contacts",
  "Team",
  "Marketing",
];

export function AccountTabs({ panels }: { panels: Record<AccountTabKey, ReactNode> }) {
  const [tab, setTab] = useState<AccountTabKey>("Details");
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
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
          borderBottom: "1px solid #dddbda",
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
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: active ? 700 : 400,
                color: active ? "#080707" : "#0070d2",
                borderBottom: active ? "3px solid #0070d2" : "3px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t}
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
                color: "#1589ee",
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
