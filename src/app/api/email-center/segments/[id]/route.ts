import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const seg = await prisma.segment.findUnique({ where: { id } });
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(seg);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    entity?: string;
    filters?: unknown;
  };
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.entity !== undefined) data.entity = body.entity === "Contact" ? "Contact" : "Lead";
  if (body.filters !== undefined) data.filters = Array.isArray(body.filters) ? body.filters : [];
  const seg = await prisma.segment.update({ where: { id }, data: data as never }).catch(() => null);
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(seg);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const seg = await prisma.segment.delete({ where: { id } }).catch(() => null);
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
