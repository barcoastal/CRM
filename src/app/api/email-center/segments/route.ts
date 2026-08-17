import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { validateSegmentFilters } from "@/lib/email/segment-fields";
import type { ListFilter } from "@/lib/list-views";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const items = await prisma.segment.findMany({
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    entity?: string;
    filters?: unknown;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const entity = body.entity === "Contact" ? "Contact" : "Lead";
  const filters = (Array.isArray(body.filters) ? body.filters : []) as ListFilter[];
  const fieldErr = validateSegmentFilters(filters, entity);
  if (fieldErr) return NextResponse.json({ error: fieldErr }, { status: 400 });
  const seg = await prisma.segment.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      entity,
      filters: filters as never,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(seg, { status: 201 });
}
