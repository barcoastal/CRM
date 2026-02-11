import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateDebtSchema } from "@/lib/validations/debt";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, debtId } = await params;

  const debt = await prisma.debt.findFirst({
    where: { id: debtId, clientId: id },
    include: {
      negotiations: {
        include: {
          negotiator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!debt) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  return NextResponse.json(debt);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, debtId } = await params;

  const existing = await prisma.debt.findFirst({
    where: { id: debtId, clientId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateDebtSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.creditorName !== undefined) updateData.creditorName = data.creditorName;
  if (data.creditorPhone !== undefined) updateData.creditorPhone = data.creditorPhone || null;
  if (data.creditorEmail !== undefined) updateData.creditorEmail = data.creditorEmail || null;
  if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber || null;
  if (data.originalBalance !== undefined) updateData.originalBalance = data.originalBalance;
  if (data.currentBalance !== undefined) updateData.currentBalance = data.currentBalance;
  if (data.enrolledBalance !== undefined) updateData.enrolledBalance = data.enrolledBalance;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.settledAmount !== undefined) updateData.settledAmount = data.settledAmount ?? null;
  if (data.settledDate !== undefined) {
    updateData.settledDate = data.settledDate ? new Date(data.settledDate) : null;
  }
  if (data.isDelinquent !== undefined) updateData.isDelinquent = data.isDelinquent;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  // When status changes to SETTLED, calculate savings
  if (data.status === "SETTLED") {
    const settledAmount = data.settledAmount ?? existing.settledAmount ?? 0;
    const enrolledBalance = data.enrolledBalance ?? existing.enrolledBalance;
    const savingsAmount = enrolledBalance - settledAmount;
    const savingsPercent = enrolledBalance > 0
      ? (savingsAmount / enrolledBalance) * 100
      : 0;

    updateData.settledAmount = settledAmount;
    updateData.savingsAmount = savingsAmount;
    updateData.savingsPercent = Math.round(savingsPercent * 100) / 100;
    if (!updateData.settledDate) {
      updateData.settledDate = new Date();
    }
  }

  const debt = await prisma.debt.update({
    where: { id: debtId },
    data: updateData,
    include: {
      negotiations: {
        include: {
          negotiator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { date: "desc" },
      },
    },
  });

  // If settled, update client.totalSettled (sum of all settled debts for this client)
  if (data.status === "SETTLED") {
    const settledDebts = await prisma.debt.findMany({
      where: { clientId: id, status: "SETTLED" },
      select: { settledAmount: true },
    });

    const totalSettled = settledDebts.reduce(
      (sum, d) => sum + (d.settledAmount ?? 0),
      0
    );

    await prisma.client.update({
      where: { id },
      data: { totalSettled },
    });
  }

  return NextResponse.json(debt);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, debtId } = await params;

  const existing = await prisma.debt.findFirst({
    where: { id: debtId, clientId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  await prisma.debt.delete({ where: { id: debtId } });

  return NextResponse.json({ success: true });
}
