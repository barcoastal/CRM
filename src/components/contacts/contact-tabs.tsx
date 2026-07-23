"use client";

import { useState, type ReactNode } from "react";

export type ContactTabKey = "Details" | "Marketing";

// SF Debt Settlement app Contact record page: Details | Marketing (verified
// against the live app - no Related tab; related lists live under Details).
const TABS: ContactTabKey[] = ["Details", "Marketing"];

// Same card + tab-strip chrome as the Lead/Opp/Account record pages so all
// four record types share one look.
export function ContactTabs({
  panels,
  detailsFooter,
}: {
  panels: Record<ContactTabKey, ReactNode>;
  detailsFooter?: ReactNode;
}) {
  const [tab, setTab] = useState<ContactTabKey>("Details");
  return (
    <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#fff",
          borderBottom: "1px solid #c9c9c9",
          padding: "0 8px",
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
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
              {t}
            </button>
          );
        })}
      </div>
      <div style={{ padding: 12 }}>
        {panels[tab]}
        {tab === "Details" && detailsFooter && (
          <div style={{ marginTop: 4, padding: "8px 4px 0", fontSize: 12, textAlign: "right" }}>{detailsFooter}</div>
        )}
      </div>
    </div>
  );
}
