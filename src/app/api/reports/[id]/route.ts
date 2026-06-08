import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { REPORTABLE_OBJECT_TYPES } from "@/lib/reports/object-metadata";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) data.description = body.description ?? null;
  if (typeof body.objectType === "string") {
    if (!REPORTABLE_OBJECT_TYPES.includes(body.objectType)) {
      return NextResponse.json({ error: "Invalid objectType" }, { status: 400 });
    }
    data.objectType = body.objectType;
  }
  if (Array.isArray(body.columns)) data.columns = body.columns;
  if (Array.isArray(body.filters)) data.filters = body.filters;
  if (typeof body.groupBy === "string" || body.groupBy === null) data.groupBy = body.groupBy;
  if (typeof body.sortBy === "string" || body.sortBy === null) data.sortBy = body.sortBy;
  if (body.sortDir === "asc" || body.sortDir === "desc") data.sortDir = body.sortDir;
  if (Array.isArray(body.summarize)) data.summarize = body.summarize;
  if (typeof body.rowLimit === "number") data.rowLimit = body.rowLimit;
  if (typeof body.isShared === "boolean") data.isShared = body.isShared;

  const updated = await prisma.report.update({ where: { id }, data: data as never });

  await auditWrite({
    userId: r.session.userId,
    entity: "Report",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.report.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "Report",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, objectType: existing.objectType },
  });

  return NextResponse.json({ ok: true });
}
