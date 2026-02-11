import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNegotiationSchema } from "@/lib/validations/debt";

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
  });
  if (!debt) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const negotiations = await prisma.negotiation.findMany({
    where: { debtId },
    include: {
      negotiator: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(negotiations);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, debtId } = await params;

  const debt = await prisma.debt.findFirst({
    where: { id: debtId, clientId: id },
  });
  if (!debt) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createNegotiationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const negotiation = await prisma.negotiation.create({
    data: {
      debtId,
      negotiatorId: session.user?.id as string,
      type: data.type,
      date: new Date(data.date),
      offerAmount: data.offerAmount ?? null,
      offerPercent: data.offerPercent ?? null,
      response: data.response,
      counterAmount: data.counterAmount ?? null,
      notes: data.notes || null,
    },
    include: {
      negotiator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(negotiation, { status: 201 });
}
