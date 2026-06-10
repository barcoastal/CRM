import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = ["Lead", "Opportunity", "Account", "Case", "Task", "Event"] as const;

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  updatedAt: Date;
};

export default async function ValidationRulesListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rules = (await prisma.validationRule.findMany({
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      entityType: true,
      isActive: true,
      updatedAt: true,
    },
  })) as RuleRow[];

  const grouped: Record<string, RuleRow[]> = {};
  for (const e of ENTITY_TYPES) grouped[e] = [];
  for (const r of rules) {
    (grouped[r.entityType] ?? (grouped[r.entityType] = [])).push(r);
  }

  const totalCount = rules.length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={pageHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={pageTitle}>Validation Rules</h1>
            <p style={pageSubtitle}>
              Block writes that violate business rules. Each rule binds an
              entity to a condition plus an error message. When the condition
              matches a record being saved, the save aborts with that message.
            </p>
          </div>
          <Link href="/settings/validation-rules/new" style={primaryBtn}>
            + New Rule
          </Link>
        </div>
      </header>

      <div style={{ marginBottom: 8, fontSize: 12, color: "#54595e", padding: "0 2px" }}>
        {totalCount} rule{totalCount === 1 ? "" : "s"} across {ENTITY_TYPES.length} entities
      </div>

      {ENTITY_TYPES.map((entity) => {
        const items = grouped[entity] ?? [];
        return (
          <section key={entity} style={section}>
            <div style={sectionHeader}>
              <h2 style={sectionTitle}>{entity}</h2>
              <Link
                href={`/settings/validation-rules/builder?entityType=${entity}`}
                style={secondaryBtn}
              >
                + New Rule for {entity}
              </Link>
            </div>
            {items.length === 0 ? (
              <div style={emptyCard}>No validation rules configured for {entity}.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>Description</th>
                    <th style={th}>Status</th>
                    <th style={th}>Last Modified</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td style={td}>
                        <Link href={`/settings/validation-rules/${row.id}`} style={nameLink}>
                          {row.name}
                        </Link>
                      </td>
                      <td style={td}>
                        {row.description ? (
                          <span style={{ color: "#54595e" }}>{row.description}</span>
                        ) : (
                          <span style={muted}>none</span>
                        )}
                      </td>
                      <td style={td}>
                        <span style={row.isActive ? statusActive : statusInactive}>
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={td}>
                        {row.updatedAt.toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td style={tdRight}>
                        <Link
                          href={`/settings/validation-rules/${row.id}`}
                          style={editLink}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
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
  maxWidth: 760,
};
const section: React.CSSProperties = { marginBottom: 24 };
const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 700,
  color: "#0a0a0a",
  margin: 0,
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
const tdRight: React.CSSProperties = { ...td, textAlign: "right" };
const editLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};
const nameLink: React.CSSProperties = {
  color: "#0a0a0a",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};
const emptyCard: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #e5e7eb",
  borderRadius: 8,
  padding: 16,
  fontSize: 13,
  color: "#54595e",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const muted: React.CSSProperties = { color: "#9ca3af", fontStyle: "italic" };
const primaryBtn: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  whiteSpace: "nowrap",
};
const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#3052ff",
  border: "1px solid #3052ff",
  padding: "6px 12px",
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
};
const statusActive: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};
const statusInactive: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#6b7280",
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};
