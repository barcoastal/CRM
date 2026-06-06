import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { recalcLeadWeeklyPayment } from "@/lib/lead-debt-rollup";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { id, debtId } = await params;

  const existing = await prisma.leadDebt.findFirst({ where: { id: debtId, leadId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.type === "string") data.type = body.type;
  if (typeof body.creditorName === "string" || body.creditorName === null)
    data.creditorName = body.creditorName || null;
  if (typeof body.amount === "number") data.amount = body.amount;
  if (typeof body.frequency === "string") data.frequency = body.frequency;
  if (typeof body.paymentAmount === "number" || body.paymentAmount === null)
    data.paymentAmount = body.paymentAmount;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes || null;

  const updated = await prisma.leadDebt.update({ where: { id: debtId }, data });
  await recalcLeadWeeklyPayment(id).catch(() => undefined);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { id, debtId } = await params;
  const existing = await prisma.leadDebt.findFirst({ where: { id: debtId, leadId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.leadDebt.delete({ where: { id: debtId } });
  await recalcLeadWeeklyPayment(id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
