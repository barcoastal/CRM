"use client";

import { useState, type ReactNode } from "react";

/**
 * SF Lightning record-page section: collapsible title bar with a chevron,
 * 2-column field grid below. Each field has its label on top + value below
 * with an inline edit pencil icon on hover (visual only here).
 */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
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
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

/**
 * 2-column field grid as used on SF record pages. Pass an array of
 * [label, value] tuples.
 */
export function FieldGrid({
  fields,
  columns = 2,
}: {
  fields: [string, ReactNode][];
  columns?: 1 | 2;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "1fr 1fr",
        gap: "0 32px",
      }}
    >
      {fields.map(([label, value], i) => (
        <Field key={i} label={label} value={value} />
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid #f3f3f3",
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 12,
      }}
      className="sf-field"
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#080707", wordBreak: "break-word" }}>
          {value ?? <span style={{ color: "#b0adab" }}>—</span>}
        </div>
      </div>
      <button
        aria-label="Edit"
        className="sf-field-edit"
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 4,
          opacity: 0,
          transition: "opacity .15s",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: "#54698d" }}>
          <path d="M9.5 1L11 2.5 4 9.5 2.5 8z M3 11l-1.5-1.5L2 9l1.5 1.5z" />
        </svg>
      </button>
      <style jsx>{`
        :global(.sf-field:hover .sf-field-edit) {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
