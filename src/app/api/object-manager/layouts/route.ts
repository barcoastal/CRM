import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { getObject } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

type LayoutFieldSlot = { fieldName: string; span?: 1 | 2 };
type LayoutSection = { name: string; columns: 1 | 2; fields: LayoutFieldSlot[] };
type LayoutJson = { sections: LayoutSection[] };

function normalizeLayout(value: unknown, knownFields: Set<string>): LayoutJson | null {
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

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const entityType = String(body?.entityType ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const recordType = body?.recordType ? String(body.recordType).trim() : null;
  const isDefault = !!body?.isDefault;

  if (!entityType || !name) {
    return NextResponse.json(
      { error: "entityType and name are required" },
      { status: 400 },
    );
  }
  const obj = getObject(entityType);
  if (!obj) {
    return NextResponse.json({ error: `Unknown entityType: ${entityType}` }, { status: 400 });
  }

  const knownFields = new Set(obj.fields.map((f) => f.name));
  const layout = normalizeLayout(body?.layout, knownFields) ?? { sections: [] };

  if (isDefault) {
    await prisma.pageLayout.updateMany({
      where: { entityType, isDefault: true },
      data: { isDefault: false },
    });
  }

  const created = await prisma.pageLayout.create({
    data: {
      entityType,
      name,
      recordType,
      isDefault,
      layout: layout as unknown as object,
      createdById: r.session.userId,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "PageLayout",
    entityId: created.id,
    action: "CREATE",
    after: created as unknown as Record<string, unknown>,
  });

  return NextResponse.json(created, { status: 201 });
}
