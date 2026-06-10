import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { getObject } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const entityType = String(body?.entityType ?? "").trim();
  const fieldName = String(body?.fieldName ?? "").trim();
  const label = String(body?.label ?? "").trim();
  const helpText = body?.helpText == null ? null : String(body.helpText);
  const isRequired = !!body?.isRequired;
  const isReadOnly = !!body?.isReadOnly;
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;

  if (!entityType || !fieldName || !label) {
    return NextResponse.json(
      { error: "entityType, fieldName, and label are required" },
      { status: 400 },
    );
  }

  const obj = getObject(entityType);
  if (!obj) {
    return NextResponse.json({ error: `Unknown entityType: ${entityType}` }, { status: 400 });
  }
  if (!obj.fields.some((f) => f.name === fieldName)) {
    return NextResponse.json(
      { error: `Unknown field ${fieldName} on ${entityType}` },
      { status: 400 },
    );
  }

  const existing = await prisma.objectFieldLabel.findUnique({
    where: { entityType_fieldName: { entityType, fieldName } },
  });

  const saved = await prisma.objectFieldLabel.upsert({
    where: { entityType_fieldName: { entityType, fieldName } },
    update: { label, helpText, isRequired, isReadOnly, sortOrder },
    create: {
      entityType,
      fieldName,
      label,
      helpText,
      isRequired,
      isReadOnly,
      sortOrder,
      createdById: r.session.userId,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "ObjectFieldLabel",
    entityId: saved.id,
    action: existing ? "UPDATE" : "CREATE",
    before: existing ? (existing as unknown as Record<string, unknown>) : undefined,
    after: saved as unknown as Record<string, unknown>,
  });

  return NextResponse.json(saved, { status: existing ? 200 : 201 });
}
