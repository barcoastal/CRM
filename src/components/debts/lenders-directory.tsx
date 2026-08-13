"use client";

import { useMemo, useState } from "react";
import { LENDER_INTEL } from "@/lib/lender-intel";

/** Full lender intel sheet as a searchable, filterable directory page. */
export function LendersDirectory() {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [onlyCoj, setOnlyCoj] = useState(false);
  const [onlyTro, setOnlyTro] = useState(false);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return LENDER_INTEL.filter((l) => {
      if (n && !`${l.name} ${l.aka ?? ""} ${l.notes ?? ""}`.toLowerCase().includes(n)) return false;
      if (risk && String(l.lienRiskLevel ?? "") !== risk) return false;
      if (onlyCoj && !l.coj) return false;
      if (onlyTro && !l.tro) return false;
      return true;
    });
  }, [q, risk, onlyCoj, onlyTro]);

  const riskChip = (level?: 1 | 2 | 3) => {
    if (!level) return null;
    const st =
      level === 1
        ? { bg: "#eaf5ec", color: "#2e844a" }
        : level === 2
        ? { bg: "#fdf3e2", color: "#8c5f10" }
        : { bg: "#fdecea", color: "#c23934" };
    return (
      <span style={{ padding: "1px 10px", borderRadius: 10, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>
        {level}
      </span>
    );
  };
  const warn = (label: string) => (
    <span style={{ padding: "1px 8px", borderRadius: 10, background: "#fdecea", color: "#c23934", fontSize: 11, fontWeight: 700, marginRight: 4 }}>
      {label}
    </span>
  );

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: "12px 16px",
          marginBottom: 8,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#181818" }}>
          Lenders ({rows.length}{rows.length !== LENDER_INTEL.length ? ` of ${LENDER_INTEL.length}` : ""})
        </h1>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#747474" }}>
          The lender intel sheet: risk level, COJ / TRO exposure, venue and negotiation notes.
          This is the same data shown next to the creditor picker when adding a debt.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lender, alias or note..."
            style={{ height: 32, padding: "0 10px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, width: 280 }}
          />
          <select value={risk} onChange={(e) => setRisk(e.target.value)} style={{ height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#fff" }}>
            <option value="">All risk levels</option>
            <option value="1">Risk 1 - works with us</option>
            <option value="2">Risk 2 - medium</option>
            <option value="3">Risk 3 - aggressive</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={onlyCoj} onChange={(e) => setOnlyCoj(e.target.checked)} /> COJ only
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={onlyTro} onChange={(e) => setOnlyTro(e.target.checked)} /> TRO only
          </label>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
              <th style={th}>Lender</th>
              <th style={th}>AKA / DBA</th>
              <th style={{ ...th, width: 60 }}>Risk</th>
              <th style={{ ...th, width: 110 }}>Flags</th>
              <th style={{ ...th, width: 110 }}>Sues in</th>
              <th style={th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.name} style={{ borderBottom: "1px solid #f3f3f3", verticalAlign: "top" }}>
                <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{l.name}</td>
                <td style={{ ...td, color: "#747474" }}>{l.aka ?? ""}</td>
                <td style={td}>{riskChip(l.lienRiskLevel)}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {l.coj && warn("COJ")}
                  {l.tro && warn("TRO")}
                  {l.plaidFinicity && (
                    <span style={{ padding: "1px 8px", borderRadius: 10, background: "#eef1f8", color: "#3052FF", fontSize: 11, fontWeight: 700 }}>
                      Plaid
                    </span>
                  )}
                </td>
                <td style={td}>{l.venue ?? ""}</td>
                <td style={{ ...td, lineHeight: 1.5 }}>{l.notes ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#747474" }}>
                  No lenders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = { padding: "8px 12px", color: "#181818" };
