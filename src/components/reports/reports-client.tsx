"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReportBuilder, REPORT_LIBRARY, type ReportKey } from "./report-builder";

function ReportsBody() {
  const search = useSearchParams();
  const initial = search.get("report") as ReportKey | null;
  const [showBuilder, setShowBuilder] = useState<ReportKey | null>(initial);
  const [filter, setFilter] = useState("");

  const filtered = REPORT_LIBRARY.filter((r) =>
    `${r.name} ${r.folder} ${r.description}`.toLowerCase().includes(filter.toLowerCase()),
  );

  if (showBuilder) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "#fff",
            border: "1px solid #dddbda",
            borderRadius: 4,
            padding: 12,
          }}
        >
          <div>
            <button
              onClick={() => setShowBuilder(null)}
              style={{
                background: "transparent",
                border: 0,
                color: "#0070d2",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ← All Reports
            </button>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#080707", marginTop: 4 }}>
              Report Builder
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnStyle("ghost")}>Save</button>
            <button style={btnStyle("ghost")}>Save As</button>
            <button style={btnStyle("ghost")}>Subscribe</button>
            <button style={btnStyle("primary")}>Run</button>
          </div>
        </div>
        <ReportBuilder initialReport={showBuilder} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              background: "#0070d2",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
              <use xlinkHref="/slds/icons/standard-sprite/svg/symbols.svg#report" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 11, color: "#706e6b" }}>Reports</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#080707" }}>All Reports</div>
            <div style={{ fontSize: 11, color: "#706e6b" }}>
              {filtered.length} item{filtered.length === 1 ? "" : "s"} ·{" "}
              Sorted by Name
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            placeholder="Search reports…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "6px 8px",
              fontSize: 13,
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              minWidth: 220,
              height: 32,
            }}
          />
          <button style={btnStyle("ghost")}>New Folder</button>
          <button style={btnStyle("primary")} onClick={() => setShowBuilder("leads-by-status")}>
            New Report
          </button>
        </div>
      </header>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #dddbda",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#fafaf9" }}>
            <tr>
              {["Name", "Description", "Folder", "Type", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderBottom: "1px solid #dddbda",
                    color: "#3e3e3c",
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ padding: "8px 12px" }}>
                  <button
                    onClick={() => setShowBuilder(r.key)}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "#0070d2",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 13,
                      textAlign: "left",
                    }}
                  >
                    {r.name}
                  </button>
                </td>
                <td style={{ padding: "8px 12px", color: "#3e3e3c", fontSize: 12 }}>
                  {r.description}
                </td>
                <td style={{ padding: "8px 12px", color: "#706e6b", fontSize: 12 }}>{r.folder}</td>
                <td style={{ padding: "8px 12px", color: "#706e6b", fontSize: 12 }}>{r.entity}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                  <Link
                    href={`/reports?report=${r.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowBuilder(r.key);
                    }}
                    style={{ color: "#0070d2", fontSize: 12, textDecoration: "none" }}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
                  No reports match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsClient() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#706e6b" }}>Loading reports…</div>}>
      <ReportsBody />
    </Suspense>
  );
}

function btnStyle(variant: "primary" | "ghost"): React.CSSProperties {
  if (variant === "primary") {
    return {
      background: "#0070d2",
      color: "#fff",
      border: "1px solid #0070d2",
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 600,
      borderRadius: 4,
      cursor: "pointer",
      height: 28,
    };
  }
  return {
    background: "#fff",
    color: "#0070d2",
    border: "1px solid #c9c9c9",
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
    cursor: "pointer",
    height: 28,
  };
}
