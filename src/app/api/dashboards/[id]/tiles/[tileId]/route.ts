import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteCtx {
  params: Promise<{ id: string; tileId: string }>;
}

const VALID_KINDS = new Set(["kpi", "count", "sum", "bar", "table", "report"]);

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const gate = await analyticsApiAccess("Dashboards.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id, tileId } = await ctx.params;
  const tile = await prisma.dashboardTile.findFirst({ where: { id: tileId, dashboardId: id, dashboard: { is: definitionScope(access, true) } } });
  if (!tile || tile.dashboardId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.kind === "string" && VALID_KINDS.has(body.kind)) data.kind = body.kind;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.queryKey === "string" || body.queryKey === null) data.queryKey = body.queryKey;
  if (typeof body.reportId === "string" || body.reportId === null) data.reportId = body.reportId;
  if (body.config && typeof body.config === "object") data.config = body.config;
  if (body.position && typeof body.position === "object") data.position = body.position;

  const updated = await prisma.dashboardTile.update({ where: { id: tileId, dashboardId: id, dashboard: { is: definitionScope(access, true) } }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const gate = await analyticsApiAccess("Dashboards.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id, tileId } = await ctx.params;
  const tile = await prisma.dashboardTile.findFirst({ where: { id: tileId, dashboardId: id, dashboard: { is: definitionScope(access, true) } } });
  if (!tile || tile.dashboardId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.dashboardTile.delete({ where: { id: tileId, dashboardId: id, dashboard: { is: definitionScope(access, true) } } });
  return NextResponse.json({ ok: true });
}
