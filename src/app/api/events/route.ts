import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createEventSchema } from "@/lib/validations/event";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Event.View");
  if ("response" in r) return r.response;
  const url = new URL(req.url);

  const where: Record<string, unknown> = {};
  for (const key of ["accountId", "opportunityId", "leadId", "contactId", "ownerId", "status", "recordType"] as const) {
    const v = url.searchParams.get(key);
    if (v) where[key] = v;
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) where.startAt = { gte: new Date(from) };
  if (to) where.endAt = { ...((where.endAt as object) ?? {}), lte: new Date(to) };
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  const items = await prisma.event.findMany({
    where,
    take: limit,
    orderBy: [{ startAt: "asc" }],
    include: {
      owner: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, recordType: true } },
      lead: { select: { id: true, businessName: true, contactName: true } },
      contact: { select: { id: true, fullName: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Event.Create");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const event = await prisma.event.create({
    data: {
      ...d,
      ownerId: d.ownerId ?? r.session.userId,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
    },
  });
  return NextResponse.json(event, { status: 201 });
}
