import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { getObject } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

type LayoutFieldSlot = { fieldName: string; span?: 1 | 2 };
type LayoutSection = { name: string; columns: 1 | 2; fields: LayoutFieldSlot[] };
type LayoutJson = { sections: LayoutSection[] };

function normalizeLayout(value: unknown, knownFields: Set<string>): LayoutJson {
  if (!value || typeof value !== "object") return { sections: [] };
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return { sections: [] };
  const out: LayoutSection[] = [];
  for (const s of sections) {
    if (!s || typeof s !== "object") continue;
    const obj = s as { name?: unknown; columns?: unknown; fields?: unknown };
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const cols = obj.columns === 2 ? 2 : 1;
    const fields = Array.isArray(obj.fields) ? obj.fields : [];
    const cleanedFields: LayoutFieldSlot[] = [];
    for (const f of fields) {
      if (!f || typeof f !== "object") continue;
      const fo = f as { fieldName?: unknown; span?: unknown };
      const fieldName = typeof fo.fieldName === "string" ? fo.fieldName : "";
      if (!fieldName || !knownFields.has(fieldName)) continue;
      const span: 1 | 2 = fo.span === 2 ? 2 : 1;
      cleanedFields.push({ fieldName, span });
    }
    if (!name) continue;
    out.push({ name, columns: cols, fields: cleanedFields });
  }
  return { sections: out };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const layout = await prisma.pageLayout.findUnique({ where: { id } });
  if (!layout) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(layout);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;

  const existing = await prisma.pageLayout.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const obj = getObject(existing.entityType);
  if (!obj) {
    return NextResponse.json(
      { error: `Unknown entityType: ${existing.entityType}` },
      { status: 400 },
    );
  }
  const knownFields = new Set(obj.fields.map((f) => f.name));

  const data: {
    name?: string;
    recordType?: string | null;
    isDefault?: boolean;
    layout?: object;
  } = {};

  if (typeof body?.name === "string") data.name = body.name.trim();
  if (body?.recordType === null || typeof body?.recordType === "string") {
    data.recordType = body.recordType ? String(body.recordType).trim() : null;
  }
  if (typeof body?.isDefault === "boolean") data.isDefault = body.isDefault;
  if (body?.layout !== undefined) {
    data.layout = normalizeLayout(body.layout, knownFields) as unknown as object;
  }

  if (data.isDefault === true) {
    await prisma.pageLayout.updateMany({
      where: { entityType: existing.entityType, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.pageLayout.update({
    where: { id },
    data,
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "PageLayout",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;

  const existing = await prisma.pageLayout.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pageLayout.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "PageLayout",
    entityId: id,
    action: "DELETE",
    before: existing as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
