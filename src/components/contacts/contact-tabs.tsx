"use client";

import { useState, type ReactNode } from "react";

export type ContactTabKey = "Details" | "Marketing";

const TABS: ContactTabKey[] = ["Details", "Marketing"];

export function ContactTabs({
  panels,
  detailsFooter,
}: {
  panels: Record<ContactTabKey, ReactNode>;
  detailsFooter?: ReactNode;
}) {
  const [tab, setTab] = useState<ContactTabKey>("Details");
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          padding: "0 12px",
          marginBottom: 8,
          overflowX: "auto",
          boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
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
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#16325c" : "#3e3e3c",
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
      <div>{panels[tab]}</div>
      {tab === "Details" && detailsFooter && (
        <div style={{ marginTop: 4, padding: "8px 4px", fontSize: 12 }}>{detailsFooter}</div>
      )}
    </div>
  );
}
