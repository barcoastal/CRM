import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createDebtSchema } from "@/lib/validations/debt";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const debts = await prisma.debt.findMany({
    where: { clientId: id },
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(debts);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createDebtSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const debt = await prisma.debt.create({
    data: {
      clientId: id,
      creditorName: data.creditorName,
      creditorPhone: data.creditorPhone || null,
      creditorEmail: data.creditorEmail || null,
      accountNumber: data.accountNumber || null,
      originalBalance: data.originalBalance,
      currentBalance: data.currentBalance,
      enrolledBalance: data.enrolledBalance,
      notes: data.notes || null,
    },
    include: {
      negotiations: true,
    },
  });

  return NextResponse.json(debt, { status: 201 });
}
