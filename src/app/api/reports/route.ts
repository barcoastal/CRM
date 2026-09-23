import { reportOptionsSchema } from "@/lib/reports/advanced";
import { validateFormulas } from "@/lib/reports/formulas";
import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { REPORTABLE_OBJECT_TYPES } from "@/lib/reports/object-metadata";

export async function GET(req: NextRequest) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;

  const url = new URL(req.url);
  const objectType = url.searchParams.get("objectType");
  const where: Record<string, unknown> = { AND: [definitionScope(access)] };
  if (objectType) where.objectType = objectType;

  const items = await prisma.report.findMany({
    where,
    orderBy: [{ objectType: "asc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return ssnSafeJson({ items });
}

export async function POST(req: NextRequest) {
  const gate = await analyticsApiAccess("Reports.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objectType = typeof body.objectType === "string" ? body.objectType : "";

  if (!name) return ssnSafeJson({ error: "Name is required" }, { status: 400 });
  if (!REPORTABLE_OBJECT_TYPES.includes(objectType)) {
    return ssnSafeJson({ error: "Invalid objectType" }, { status: 400 });
  }

  const options = reportOptionsSchema.safeParse(body.options ?? {});
  if (!options.success) return ssnSafeJson({ error: "Invalid grouping options" }, { status: 400 });
  let formulas;
  try { formulas = validateFormulas(body.formulas, objectType); }
  catch (e) { return ssnSafeJson({ error: e instanceof Error ? e.message : "Invalid formulas" }, { status: 400 }); }
  const created = await prisma.report.create({
    data: {
      formulas,
      options: options.data,
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
      createdById: access.userId,
    },
  });

  await auditWrite({
    userId: access.userId,
    entity: "Report",
    entityId: created.id,
    action: "CREATE",
    after: { name: created.name, objectType: created.objectType },
  });

  return ssnSafeJson(created, { status: 201 });
}
