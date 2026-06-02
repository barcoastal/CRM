import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateListViewSchema } from "@/lib/validations/list-view";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const view = await prisma.listView.findUnique({ where: { id } });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const view = await prisma.listView.findUnique({ where: { id } });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (view.isSystem) {
    return NextResponse.json({ error: "System views can't be edited" }, { status: 403 });
  }
  if (view.ownerId !== r.session.userId && !view.isShared) {
    return NextResponse.json({ error: "Not your view" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = updateListViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.developerName !== undefined) data.developerName = d.developerName;
  if (d.filters !== undefined) data.filters = d.filters as object;
  if (d.columns !== undefined) data.columns = d.columns ? (d.columns as object) : null;
  if (d.sortField !== undefined) data.sortField = d.sortField;
  if (d.sortDir !== undefined) data.sortDir = d.sortDir;
  if (d.isShared !== undefined) data.isShared = d.isShared;
  if (d.isPinned !== undefined) data.isPinned = d.isPinned;

  const updated = await prisma.listView.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const view = await prisma.listView.findUnique({ where: { id } });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (view.isSystem) {
    return NextResponse.json({ error: "System views can't be deleted" }, { status: 403 });
  }
  if (view.ownerId !== r.session.userId) {
    return NextResponse.json({ error: "Not your view" }, { status: 403 });
  }
  await prisma.listView.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
