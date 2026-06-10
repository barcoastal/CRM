import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeObjects } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

export default async function ObjectManagerIndexPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const objects = summarizeObjects();
  const [labelCounts, layoutCounts] = await Promise.all([
    prisma.objectFieldLabel.groupBy({ by: ["entityType"], _count: { _all: true } }),
    prisma.pageLayout.groupBy({ by: ["entityType"], _count: { _all: true } }),
  ]);
  const byLabel = new Map(labelCounts.map((l) => [l.entityType, l._count._all]));
  const byLayout = new Map(layoutCounts.map((l) => [l.entityType, l._count._all]));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={pageHeader}>
        <div>
          <h1 style={pageTitle}>Object Manager</h1>
          <p style={pageSubtitle}>
            Every object in the schema, with its fields, picklist values, and
            page layouts. Field metadata is read from the Prisma data model at
            request time and cannot be changed here. Label overrides, help
            text, picklist values, and page layouts can be edited.
          </p>
        </div>
      </header>

      <div style={{ marginBottom: 8, fontSize: 12, color: "#54595e", padding: "0 2px" }}>
        {objects.length} object{objects.length === 1 ? "" : "s"}
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Fields</th>
            <th style={th}>Label Overrides</th>
            <th style={th}>Page Layouts</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.name}>
              <td style={td}>
                <Link href={`/settings/object-manager/${o.name}`} style={nameLink}>
                  {o.name}
                </Link>
              </td>
              <td style={td}>{o.fieldCount}</td>
              <td style={td}>{byLabel.get(o.name) ?? 0}</td>
              <td style={td}>{byLayout.get(o.name) ?? 0}</td>
              <td style={tdRight}>
                <Link
                  href={`/settings/object-manager/${o.name}`}
                  style={editLink}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  maxWidth: 820,
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
