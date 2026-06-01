import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateEventSchema } from "@/lib/validations/event";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Event.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      owner: true, account: true, opportunity: true, lead: true, contact: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Event.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.startAt) data.startAt = new Date(d.startAt);
  if (d.endAt) data.endAt = new Date(d.endAt);
  const event = await prisma.event.update({ where: { id }, data });
  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Event.Delete");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  await prisma.event.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
