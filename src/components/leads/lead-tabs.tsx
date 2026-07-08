"use client";

import { useState, type ReactNode } from "react";

export type LeadTabKey =
  | "Details"
  | "Debt Information"
  | "Payment Calculator"
  | "Documents"
  | "Related"
  | "Marketing"
  | "All SF Fields";

// SF Lightning Lead record-page tab order (verified against
// docs/sf-screenshots/sf-lead-detail.png). Activities live on the rail
// (Activity/Chatter card), not in the main tab strip. "All SF Fields"
// is reachable via the footer link, same as the Opportunity page.
const TABS: LeadTabKey[] = [
  "Details",
  "Debt Information",
  "Payment Calculator",
  "Documents",
  "Related",
  "Marketing",
];

export function LeadTabs({ panels }: { panels: Record<LeadTabKey, ReactNode> }) {
  const [tab, setTab] = useState<LeadTabKey>("Details");
  return (
    <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4 }}>
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#fff",
          borderBottom: "1px solid #d8dde6",
          padding: "0 8px",
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
                padding: "12px 14px 10px",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#080707" : "#3e3e3c",
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
      <div style={{ padding: 12 }}>
        {panels[tab]}
        {tab === "Details" && (
          <div
            style={{
              padding: "6px 4px 0",
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
