import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const gate = await analyticsApiAccess("Dashboards.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;
  const dash = await prisma.dashboard.findFirst({
    where: { id, AND: [definitionScope(access)] },
    include: {
      tiles: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!dash) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(dash);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const gate = await analyticsApiAccess("Dashboards.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.dashboard.findFirst({ where: { id, AND: [definitionScope(access, true)] } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) {
    data.description = body.description;
  }
  if (typeof body.isShared === "boolean") data.isShared = body.isShared;
  if (Array.isArray(body.layout)) data.layout = body.layout;

  const dash = await prisma.dashboard.update({ where: { id, AND: [definitionScope(access, true)] }, data });
  return NextResponse.json(dash);
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const gate = await analyticsApiAccess("Dashboards.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;
  const existing = await prisma.dashboard.findFirst({ where: { id, AND: [definitionScope(access, true)] } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.dashboard.delete({ where: { id, AND: [definitionScope(access, true)] } });
  return NextResponse.json({ ok: true });
}
