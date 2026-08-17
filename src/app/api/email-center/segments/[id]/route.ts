import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { validateSegmentFilters } from "@/lib/email/segment-fields";
import type { ListFilter } from "@/lib/list-views";

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
  if (body.filters !== undefined) {
    const incoming = (Array.isArray(body.filters) ? body.filters : []) as ListFilter[];
    // Resolve entity: prefer incoming body.entity, else load existing segment's entity.
    let resolvedEntity = body.entity === "Contact" ? "Contact" : body.entity === "Lead" ? "Lead" : null;
    if (!resolvedEntity) {
      const existing = await prisma.segment.findUnique({ where: { id }, select: { entity: true } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      resolvedEntity = existing.entity;
    }
    const fieldErr = validateSegmentFilters(incoming, resolvedEntity);
    if (fieldErr) return NextResponse.json({ error: fieldErr }, { status: 400 });
    data.filters = incoming;
  }
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
