"use client";

import { useState, type ReactNode } from "react";

export type ContactTabKey = "Details" | "Marketing";

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
              type="button"
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
        {tab === "Details" && detailsFooter && (
          <div style={{ marginTop: 4, padding: "8px 4px 0", fontSize: 12, textAlign: "right" }}>{detailsFooter}</div>
        )}
      </div>
    </div>
  );
}
