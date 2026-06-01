import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateSettlementSchema } from "@/lib/validations/settlement";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Settlement.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: { debt: { include: { creditor: true, programPlan: true } }, offer: true, approvedBy: true },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(s);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Settlement.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.payoffDueDate) data.payoffDueDate = new Date(d.payoffDueDate);
  if (d.payoffPaidDate) data.payoffPaidDate = new Date(d.payoffPaidDate);
  const s = await prisma.settlement.update({ where: { id }, data });
  return NextResponse.json(s);
}
