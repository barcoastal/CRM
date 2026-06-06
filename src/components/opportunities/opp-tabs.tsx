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

const TABS: OppTabKey[] = [
  "Details",
  "Activities",
  "Debt Information",
  "Payment Calculator",
  "Settlements",
  "Documents",
  "Related",
  "Marketing",
  "All SF Fields",
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
                padding: "12px 18px",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
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
    </div>
  );
}
