import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { REPORTABLE_OBJECT_TYPES } from "@/lib/reports/object-metadata";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;
  const report = await prisma.report.findFirst({
    where: { id, AND: [definitionScope(access)] },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!report) return ssnSafeJson({ error: "Not found" }, { status: 404 });
  return ssnSafeJson(report);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await analyticsApiAccess("Reports.Edit");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;

  const existing = await prisma.report.findFirst({ where: { id, AND: [definitionScope(access, true)] } });
  if (!existing) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) data.description = body.description ?? null;
  if (typeof body.objectType === "string") {
    if (!REPORTABLE_OBJECT_TYPES.includes(body.objectType)) {
      return ssnSafeJson({ error: "Invalid objectType" }, { status: 400 });
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

  const updated = await prisma.report.update({ where: { id, AND: [definitionScope(access, true)] }, data: data as never });

  await auditWrite({
    userId: access.userId,
    entity: "Report",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return ssnSafeJson(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await analyticsApiAccess("Reports.Edit");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;

  const existing = await prisma.report.findFirst({ where: { id, AND: [definitionScope(access, true)] } });
  if (!existing) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  await prisma.report.delete({ where: { id, AND: [definitionScope(access, true)] } });
  await auditWrite({
    userId: access.userId,
    entity: "Report",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, objectType: existing.objectType },
  });

  return ssnSafeJson({ ok: true });
}
