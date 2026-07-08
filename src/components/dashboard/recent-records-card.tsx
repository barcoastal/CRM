"use client";

import Link from "next/link";

export interface RecentRecord {
  id: string;
  name: string;
  stage: string | null;
  updatedAt: string;
}

export function RecentRecordsCard({ records }: { records: RecentRecord[] }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #c9c9c9",
          background: "#fafaf9",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 52 52" style={{ fill: "#54698d" }}>
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#recent" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>
          Recent Records
        </div>
      </header>
      <div style={{ padding: 0 }}>
        {records.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "#747474", fontSize: 12 }}>
            Nothing here yet — viewed records show up below.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {records.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderBottom: "1px solid #f3f3f3",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    background: "#7f8de1",
                    borderRadius: 3,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <Link
                  href={`/accounts/${r.id}`}
                  style={{ color: "#0176d3", fontSize: 13, textDecoration: "none", flex: 1 }}
                >
                  {r.name}
                </Link>
                {r.stage ? (
                  <span style={{ color: "#747474", fontSize: 11 }}>{r.stage}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer
        style={{
          borderTop: "1px solid #c9c9c9",
          padding: "6px 12px",
          fontSize: 11,
          textAlign: "center",
          color: "#0176d3",
          fontWeight: 600,
          background: "#fafaf9",
        }}
      >
        <Link href="/accounts" style={{ color: "#0176d3", textDecoration: "none" }}>
          View All
        </Link>
      </footer>
    </div>
  );
}
