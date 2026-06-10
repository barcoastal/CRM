import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/object-manager/dmmf";
import { LayoutEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ name: string; layoutId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { name, layoutId } = await params;
  const meta = getObject(name);
  if (!meta) notFound();

  const layout = await prisma.pageLayout.findUnique({ where: { id: layoutId } });
  if (!layout || layout.entityType !== name) notFound();

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 8, fontSize: 13 }}>
        <Link href="/settings/object-manager" style={breadcrumbLink}>
          Object Manager
        </Link>
        <span style={crumbSep}>/</span>
        <Link href={`/settings/object-manager/${name}?tab=layouts`} style={breadcrumbLink}>
          {name}
        </Link>
        <span style={crumbSep}>/</span>
        <span style={{ color: "#54595e" }}>{layout.name}</span>
      </div>

      <LayoutEditor
        layoutId={layout.id}
        entity={name}
        initialName={layout.name}
        initialIsDefault={layout.isDefault}
        initialRecordType={layout.recordType}
        initialLayout={layout.layout as unknown}
        fields={meta.fields.map((f) => ({
          name: f.name,
          kind: f.kind,
          type: f.type,
          isList: f.isList,
          isRequired: f.isRequired,
        }))}
      />
    </div>
  );
}

const breadcrumbLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontWeight: 600,
};
const crumbSep: React.CSSProperties = {
  color: "#9ca3af",
  margin: "0 6px",
};
