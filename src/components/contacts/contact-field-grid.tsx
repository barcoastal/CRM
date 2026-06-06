"use client";

import type { ReactNode } from "react";

/**
 * SF Lightning Contact detail field grid — label LEFT, value to the right,
 * thin row borders, inline edit pencil at the far right.
 * Two such columns side by side per the SF screenshot.
 */
export function ContactFieldGrid({ fields, columns = 2 }: { fields: [string, ReactNode][]; columns?: 1 | 2 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "1fr 1fr",
        columnGap: 32,
      }}
    >
      {fields.map(([label, value], i) => (
        <ContactField key={i} label={label} value={value} />
      ))}
    </div>
  );
}

export function ContactField({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value == null || value === "" || value === false;
  return (
    <div
      className="sfc-field"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 165px) 1fr 24px",
        alignItems: "start",
        gap: 12,
        padding: "8px 0",
        minHeight: 32,
        borderBottom: "1px solid #ecebea",
        fontSize: 13,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          color: "#3e3e3c",
          fontWeight: 400,
          fontSize: 12,
          paddingTop: 1,
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#080707",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {isEmpty ? <span style={{ color: "#b0adab" }}>{"—"}</span> : value}
      </div>
      <button
        type="button"
        aria-label={`Edit ${label}`}
        className="sfc-field-edit"
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 0,
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.55,
          borderRadius: 3,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 52 52" aria-hidden="true" style={{ fill: "#54698d" }}>
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
        </svg>
      </button>
      <style jsx>{`
        :global(.sfc-field:hover) {
          background: #fafaf9;
        }
        :global(.sfc-field:hover .sfc-field-edit) {
          opacity: 1;
        }
        :global(.sfc-field-edit:hover) {
          background: #ecebea;
        }
      `}</style>
    </div>
  );
}
