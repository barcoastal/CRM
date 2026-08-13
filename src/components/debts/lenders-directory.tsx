"use client";

import { useMemo, useState } from "react";
import { LENDER_INTEL, type LenderIntel } from "@/lib/lender-intel";
import { KNOWN_CREDITORS } from "@/lib/creditors";
import { isVictoryCreditor } from "@/lib/creditor-agreements";

const normName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");

interface DirectoryRow extends LenderIntel {
  legal: "Victory" | "Citadel";
  hasIntel: boolean;
}

// Full directory: every lender from the intel sheet PLUS the main creditors
// list (309), deduped by exact name/alias. Legal = the agreement this lender
// routes to (VLP tab -> Victory, everyone else -> Citadel).
function buildDirectory(): DirectoryRow[] {
  const covered = new Set<string>();
  const rows: DirectoryRow[] = [];
  for (const l of LENDER_INTEL) {
    covered.add(normName(l.name));
    for (const a of (l.aka ?? "").split("/")) {
      const na = normName(a);
      if (na) covered.add(na);
    }
    rows.push({
      ...l,
      hasIntel: true,
      legal: isVictoryCreditor(l.name) || (l.aka ?? "").split("/").some((a) => isVictoryCreditor(a.trim())) ? "Victory" : "Citadel",
    });
  }
  for (const name of KNOWN_CREDITORS) {
    if (covered.has(normName(name))) continue;
    covered.add(normName(name));
    rows.push({ name, hasIntel: false, legal: isVictoryCreditor(name) ? "Victory" : "Citadel" });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

const DIRECTORY = buildDirectory();

/** Full lender intel sheet as a searchable, filterable directory page. */
export function LendersDirectory() {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [onlyCoj, setOnlyCoj] = useState(false);
  const [onlyTro, setOnlyTro] = useState(false);
  const [legal, setLegal] = useState("");

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return DIRECTORY.filter((l) => {
      if (n && !`${l.name} ${l.aka ?? ""} ${l.notes ?? ""}`.toLowerCase().includes(n)) return false;
      if (risk && String(l.lienRiskLevel ?? "") !== risk) return false;
      if (onlyCoj && !l.coj) return false;
      if (onlyTro && !l.tro) return false;
      if (legal && l.legal !== legal) return false;
      return true;
    });
  }, [q, risk, onlyCoj, onlyTro, legal]);

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
          Lenders ({rows.length}{rows.length !== DIRECTORY.length ? ` of ${DIRECTORY.length}` : ""})
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
          <select value={legal} onChange={(e) => setLegal(e.target.value)} style={{ height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#fff" }}>
            <option value="">All legal</option>
            <option value="Victory">Victory</option>
            <option value="Citadel">Citadel</option>
          </select>
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
              <th style={{ ...th, width: 80 }}>Legal</th>
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
                <td style={td}>
                  <span
                    style={{
                      padding: "1px 10px",
                      borderRadius: 10,
                      background: l.legal === "Victory" ? "#eaf5ec" : "#eef1f8",
                      color: l.legal === "Victory" ? "#2e844a" : "#3052FF",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {l.legal}
                  </span>
                </td>
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
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#747474" }}>
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
