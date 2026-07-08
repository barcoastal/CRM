import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ENTITY_KEYS, type EntityKey } from "@/lib/path/field-labels";

export const dynamic = "force-dynamic";

type GuidanceRow = {
  id: string;
  entityType: string;
  stage: string;
  keyFields: unknown;
  guidance: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: Date;
};

export default async function PathGuidanceListPage() {
  const rows = (await prisma.pathGuidance.findMany({
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { stage: "asc" }],
  })) as GuidanceRow[];

  const grouped: Record<string, GuidanceRow[]> = {};
  for (const e of ENTITY_KEYS) grouped[e] = [];
  for (const r of rows) {
    (grouped[r.entityType] ?? (grouped[r.entityType] = [])).push(r);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={pageHeader}>
        <div>
          <h1 style={pageTitle}>Path Guidance</h1>
          <p style={pageSubtitle}>
            Configure Key Fields and Guidance for Success per stage. Reps see these next to the Path tracker on Lead, Opportunity, Account, and Case detail pages.
          </p>
        </div>
      </header>

      {(ENTITY_KEYS as EntityKey[]).map((entity) => {
        const items = grouped[entity] ?? [];
        return (
          <section key={entity} style={section}>
            <div style={sectionHeader}>
              <h2 style={sectionTitle}>{entity}</h2>
              <Link
                href={`/settings/path-guidance/new?entity=${entity}`}
                style={primaryBtn}
              >
                + Add Guidance
              </Link>
            </div>
            {items.length === 0 ? (
              <div style={emptyCard}>No guidance configured for {entity}.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Stage</th>
                    <th style={th}>Key Fields</th>
                    <th style={th}>Guidance Preview</th>
                    <th style={th}>Active</th>
                    <th style={th}>Updated</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const kf = Array.isArray(row.keyFields)
                      ? (row.keyFields as unknown[]).filter(
                          (v): v is string => typeof v === "string",
                        )
                      : [];
                    return (
                      <tr key={row.id}>
                        <td style={td}>{row.stage}</td>
                        <td style={td}>
                          {kf.length === 0 ? (
                            <span style={muted}>none</span>
                          ) : (
                            <span>{kf.length} field{kf.length === 1 ? "" : "s"}</span>
                          )}
                        </td>
                        <td style={tdSnippet}>
                          {row.guidance ? (
                            <span>
                              {row.guidance.slice(0, 80)}
                              {row.guidance.length > 80 ? "..." : ""}
                            </span>
                          ) : (
                            <span style={muted}>none</span>
                          )}
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              ...pill,
                              background: row.isActive ? "#2e844a" : "#ecebea",
                              color: row.isActive ? "#fff" : "#444444",
                            }}
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={td}>{row.updatedAt.toLocaleString()}</td>
                        <td style={tdRight}>
                          <Link
                            href={`/settings/path-guidance/${row.id}`}
                            style={editLink}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

const pageHeader: React.CSSProperties = {
  background: "#fff",
  padding: "16px 24px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 16,
};
const pageTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  color: "#0a0a0a",
};
const pageSubtitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 13,
  color: "#54595e",
  marginTop: 6,
  marginBottom: 0,
};
const section: React.CSSProperties = { marginBottom: 24 };
const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 700,
  margin: 0,
  color: "#0a0a0a",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
const primaryBtn: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  borderCollapse: "separate",
  borderSpacing: 0,
  overflow: "hidden",
};
const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#54595e",
  padding: "10px 14px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  borderTop: "1px solid #f0f0f0",
  fontSize: 13,
  color: "#0a0a0a",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const tdSnippet: React.CSSProperties = {
  ...td,
  maxWidth: 360,
  color: "#444444",
};
const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
};
const editLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};
const muted: React.CSSProperties = { color: "#9ca3af" };
const pill: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};
const emptyCard: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #e5e7eb",
  borderRadius: 8,
  padding: "16px 18px",
  fontSize: 13,
  color: "#6b7280",
  fontFamily: "Manrope, system-ui, sans-serif",
};
