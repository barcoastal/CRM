import { refreshAddendum, snapshot } from "@/lib/contracts/addendum";
import { canAccessRecord } from "@/lib/record-access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { debtSnapshot, PAYMENT_STATUSES } from "@/lib/debt-payment-status";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { id } = await params;

  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || (existing.opportunityId && !await canAccessRecord("opportunity", existing.opportunityId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid debt update" }, { status: 400 });
  if (body.paymentFrequency !== undefined && body.paymentFrequency !== existing.paymentFrequency && !["DAILY", "WEEKLY", "MONTHLY"].includes(body.paymentFrequency)) {
    return NextResponse.json({ error: "Choose Daily, Weekly, or Monthly." }, { status: 400 });
  }
  for (const field of ["paymentAmount", "originalBalance", "currentBalance", "enrolledBalance"] as const) {
    const amount = body[field];
    if (amount === undefined || (field === "paymentAmount" && amount === null)) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || (["originalBalance", "enrolledBalance"].includes(field) && amount === 0))
      return NextResponse.json({ error: "Enter valid nonnegative debt amounts; original and enrolled balances must be positive." }, { status: 400 });
  }
  if (typeof body.creditorName === "string" && !body.creditorName.trim()) return NextResponse.json({ error: "Creditor name is required." }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) {
      return NextResponse.json({ error: "Invalid debt payment status" }, { status: 400 });
    }
    data.sfDataJson = JSON.stringify({ ...debtSnapshot(existing.sfDataJson), Debt_Status__c: body.paymentStatus });
  }
  if (typeof body.creditorName === "string") data.creditorName = body.creditorName;
  if (typeof body.debtType === "string" || body.debtType === null) data.debtType = body.debtType || null;
  if (typeof body.paymentFrequency === "string" || body.paymentFrequency === null)
    data.paymentFrequency = body.paymentFrequency || null;
  if (typeof body.paymentAmount === "number" || body.paymentAmount === null) data.paymentAmount = body.paymentAmount;
  if (typeof body.originalBalance === "number") data.originalBalance = body.originalBalance;
  if (typeof body.currentBalance === "number") data.currentBalance = body.currentBalance;
  if (typeof body.enrolledBalance === "number") data.enrolledBalance = body.enrolledBalance;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.legalStatus === "string" || body.legalStatus === null) data.legalStatus = body.legalStatus || null;
  if (typeof body.negotiationStatus === "string" || body.negotiationStatus === null) data.negotiationStatus = body.negotiationStatus || null;
  if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes || null;

  if (typeof body.creditorName === 'string' && body.creditorName !== existing.creditorName) {
    data.creditorId=null;
    data.sfDataJson=JSON.stringify({...snapshot(typeof data.sfDataJson==='string' ? data.sfDataJson : existing.sfDataJson),Current_Creditor__c:null});
  }
  const updated = await prisma.$transaction(async tx => {
    const row=await tx.debt.update({where:{id},data});
    if(existing.opportunityId) await refreshAddendum(tx,existing.opportunityId);
    return row;
  });
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
  if (!existing || (existing.opportunityId && !await canAccessRecord("opportunity", existing.opportunityId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.$transaction(async tx => {
    await tx.debt.delete({where:{id}});
    if(existing.opportunityId) await refreshAddendum(tx,existing.opportunityId);
  });
  return NextResponse.json({ ok: true });
}
