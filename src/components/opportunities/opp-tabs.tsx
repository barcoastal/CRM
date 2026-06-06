"use client";

import { useState, type ReactNode } from "react";

export type OppTabKey =
  | "Details"
  | "Activities"
  | "Debt Information"
  | "Payment Calculator"
  | "Settlements"
  | "Documents"
  | "Related"
  | "Marketing"
  | "All SF Fields";

// SF tab bar order — exactly matches Lightning record page. "All SF Fields"
// is intentionally NOT in the tab strip; it's reachable via a footer link.
const TABS: OppTabKey[] = [
  "Details",
  "Activities",
  "Debt Information",
  "Payment Calculator",
  "Settlements",
  "Documents",
  "Related",
  "Marketing",
];

export function OppTabs({ panels }: { panels: Record<OppTabKey, ReactNode> }) {
  const [tab, setTab] = useState<OppTabKey>("Details");
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#fff",
          borderBottom: "1px solid #d8dde6",
          padding: "0 12px",
          marginBottom: 8,
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
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#080707" : "#3e3e3c",
                borderBottom: active ? "3px solid #1589ee" : "3px solid transparent",
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
      <div>
        {panels[tab]}
        {tab === "Details" && (
          <div
            style={{
              padding: "6px 16px 12px",
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
