import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { id } = await params;

  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.creditorName === "string") data.creditorName = body.creditorName;
  if (typeof body.debtType === "string" || body.debtType === null) data.debtType = body.debtType || null;
  if (typeof body.paymentFrequency === "string" || body.paymentFrequency === null)
    data.paymentFrequency = body.paymentFrequency || null;
  if (typeof body.paymentAmount === "number" || body.paymentAmount === null) data.paymentAmount = body.paymentAmount;
  if (typeof body.originalBalance === "number") data.originalBalance = body.originalBalance;
  if (typeof body.currentBalance === "number") data.currentBalance = body.currentBalance;
  if (typeof body.enrolledBalance === "number") data.enrolledBalance = body.enrolledBalance;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes || null;

  const updated = await prisma.debt.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { id } = await params;
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.debt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
