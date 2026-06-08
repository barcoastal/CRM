import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { REPORTABLE_OBJECT_TYPES } from "@/lib/reports/object-metadata";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const objectType = url.searchParams.get("objectType");
  const where: Record<string, unknown> = {};
  if (objectType) where.objectType = objectType;

  const items = await prisma.report.findMany({
    where,
    orderBy: [{ objectType: "asc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objectType = typeof body.objectType === "string" ? body.objectType : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!REPORTABLE_OBJECT_TYPES.includes(objectType)) {
    return NextResponse.json({ error: "Invalid objectType" }, { status: 400 });
  }

  const created = await prisma.report.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description : null,
      objectType,
      columns: (Array.isArray(body.columns) ? body.columns : []) as never,
      filters: (Array.isArray(body.filters) ? body.filters : []) as never,
      groupBy: typeof body.groupBy === "string" ? body.groupBy : null,
      sortBy: typeof body.sortBy === "string" ? body.sortBy : null,
      sortDir: body.sortDir === "desc" ? "desc" : "asc",
      summarize: (Array.isArray(body.summarize) ? body.summarize : []) as never,
      rowLimit: typeof body.rowLimit === "number" ? body.rowLimit : 2000,
      isShared: body.isShared !== false,
      createdById: r.session.userId,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "Report",
    entityId: created.id,
    action: "CREATE",
    after: { name: created.name, objectType: created.objectType },
  });

  return NextResponse.json(created, { status: 201 });
}
