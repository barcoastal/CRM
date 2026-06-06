"use client";

import { useState, type ReactNode } from "react";

export type LeadTabKey =
  | "Details"
  | "Activities"
  | "Lead Calculator"
  | "Documents"
  | "Related"
  | "Marketing"
  | "All SF Fields";

// SF Lightning Lead record-page tab order. "All SF Fields" is intentionally
// NOT in the visible tab strip — it's reachable via a footer link, matching
// how Opportunities expose the all-fields view.
const TABS: LeadTabKey[] = [
  "Details",
  "Activities",
  "Lead Calculator",
  "Documents",
  "Related",
  "Marketing",
];

export function LeadTabs({ panels }: { panels: Record<LeadTabKey, ReactNode> }) {
  const [tab, setTab] = useState<LeadTabKey>("Details");
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
