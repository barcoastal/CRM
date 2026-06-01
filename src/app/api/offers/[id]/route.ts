import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateOfferSchema } from "@/lib/validations/offer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Offer.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      debt: { include: { creditor: true } },
      createdBy: { select: { id: true, name: true } },
      settlement: true,
      negotiations: true,
    },
  });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(offer);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Offer.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.expiresAt) data.expiresAt = new Date(d.expiresAt);
  const offer = await prisma.offer.update({ where: { id }, data });
  return NextResponse.json(offer);
}
