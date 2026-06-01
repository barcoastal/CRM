import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createOfferSchema } from "@/lib/validations/offer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Offer.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const offers = await prisma.offer.findMany({
    where: { debtId: id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, settlement: true },
  });
  return NextResponse.json({ items: offers });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Offer.Create");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const debt = await prisma.debt.findUnique({ where: { id } });
  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = createOfferSchema.safeParse({ ...body, debtId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const balance = debt.currentBalance ?? debt.originalBalance ?? 0;
  const percentOffered = d.percentOffered ?? (balance > 0 ? d.amountOffered / balance : 0);

  const offer = await prisma.offer.create({
    data: {
      debtId: id,
      direction: d.direction,
      amountOffered: d.amountOffered,
      percentOffered,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      termsNotes: d.termsNotes ?? null,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(offer, { status: 201 });
}
