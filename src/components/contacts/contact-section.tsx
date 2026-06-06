"use client";

import { useState, type ReactNode } from "react";

/**
 * SF Lightning record-page section card for the Contact detail.
 * White card, thin border, expandable chevron + title at the top.
 * Body padding mirrors SF — 16px horizontal, 8px vertical.
 */
export function ContactSection({
  title,
  children,
  defaultOpen = true,
  bodyStyle,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  bodyStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "#fafaf9",
          border: 0,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          borderBottom: open ? "1px solid #ecebea" : "none",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform .15s",
            fill: "#3e3e3c",
          }}
        >
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#080707" }}>{title}</span>
      </button>
      {open && <div style={{ padding: "4px 16px 12px", ...bodyStyle }}>{children}</div>}
    </div>
  );
}
