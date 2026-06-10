import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/object-manager/dmmf";
import { ObjectDetailTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function ObjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { name } = await params;
  const { tab } = await searchParams;

  const meta = getObject(name);
  if (!meta) notFound();

  const [labels, layouts, dispositions] = await Promise.all([
    prisma.objectFieldLabel.findMany({
      where: { entityType: name },
      orderBy: [{ fieldName: "asc" }],
    }),
    prisma.pageLayout.findMany({
      where: { entityType: name },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.disposition.findMany({
      where: { entity: name },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 8 }}>
        <Link href="/settings/object-manager" style={breadcrumbLink}>
          Object Manager
        </Link>
        <span style={{ color: "#9ca3af", margin: "0 6px" }}>/</span>
        <span style={{ fontSize: 13, color: "#54595e" }}>{meta.name}</span>
      </div>

      <header style={pageHeader}>
        <div>
          <div style={objectKicker}>Object</div>
          <h1 style={pageTitle}>{meta.name}</h1>
          <p style={pageSubtitle}>
            {meta.fields.length} fields. Field shape, type, and default values
            are read from the Prisma data model. Display labels, help text,
            picklist values, and page layouts can be edited.
          </p>
        </div>
      </header>

      <ObjectDetailTabs
        meta={meta}
        labels={labels.map((l) => ({
          id: l.id,
          fieldName: l.fieldName,
          label: l.label,
          helpText: l.helpText,
          isRequired: l.isRequired,
          isReadOnly: l.isReadOnly,
          sortOrder: l.sortOrder,
        }))}
        layouts={layouts.map((l) => ({
          id: l.id,
          name: l.name,
          isDefault: l.isDefault,
          recordType: l.recordType,
          sectionCount: extractSectionCount(l.layout),
        }))}
        dispositions={dispositions.map((d) => ({
          id: d.id,
          category: d.category,
          value: d.value,
          label: d.label,
          isActive: d.isActive,
          sortOrder: d.sortOrder,
          stage: d.stage,
        }))}
        initialTab={(tab as "fields" | "picklists" | "layouts" | undefined) ?? "fields"}
      />
    </div>
  );
}

function extractSectionCount(layout: unknown): number {
  if (!layout || typeof layout !== "object") return 0;
  const s = (layout as { sections?: unknown }).sections;
  return Array.isArray(s) ? s.length : 0;
}

const pageHeader: React.CSSProperties = {
  background: "#fff",
  padding: "16px 24px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 16,
};
const objectKicker: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#54595e",
  marginBottom: 2,
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
const breadcrumbLink: React.CSSProperties = {
  fontSize: 13,
  color: "#3052ff",
  textDecoration: "none",
  fontWeight: 600,
};
