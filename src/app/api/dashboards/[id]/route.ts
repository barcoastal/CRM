import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const dash = await prisma.dashboard.findUnique({
    where: { id },
    include: {
      tiles: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!dash) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!dash.isShared && dash.createdById !== r.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(dash);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.dashboard.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById && existing.createdById !== r.session.userId) {
    // Allow shared-edit for now: shared boards are editable by any auth'd user.
    if (!existing.isShared) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) {
    data.description = body.description;
  }
  if (typeof body.isShared === "boolean") data.isShared = body.isShared;
  if (Array.isArray(body.layout)) data.layout = body.layout;

  const dash = await prisma.dashboard.update({ where: { id }, data });
  return NextResponse.json(dash);
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const existing = await prisma.dashboard.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById && existing.createdById !== r.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.dashboard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
