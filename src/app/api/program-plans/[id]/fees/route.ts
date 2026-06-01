import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createFeeSchema } from "@/lib/validations/fee";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Fee.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const fees = await prisma.fee.findMany({
    where: { programPlanId: id },
    orderBy: { chargedDate: "desc" },
    include: { chargedBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items: fees });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Fee.Charge");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = createFeeSchema.safeParse({ ...body, programPlanId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const fee = await prisma.fee.create({
    data: {
      ...d,
      chargedDate: d.chargedDate ? new Date(d.chargedDate) : new Date(),
      chargedById: r.session.userId,
    },
  });
  return NextResponse.json(fee, { status: 201 });
}
