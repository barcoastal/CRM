import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentSchema } from "@/lib/validations/payment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build where clause with optional filters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { clientId: id };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        debt: {
          select: { creditorName: true },
        },
      },
      orderBy: { scheduledDate: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("List payments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
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

  try {
    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If a debtId is provided, verify it belongs to this client
    if (data.debtId) {
      const debt = await prisma.debt.findFirst({
        where: { id: data.debtId, clientId: id },
        select: { id: true },
      });

      if (!debt) {
        return NextResponse.json(
          { error: "Debt not found for this client" },
          { status: 404 }
        );
      }
    }

    // Auto-set paidDate if status is COMPLETED and no paidDate provided
    const paidDate =
      data.status === "COMPLETED"
        ? data.paidDate
          ? new Date(data.paidDate)
          : new Date()
        : data.paidDate
          ? new Date(data.paidDate)
          : null;

    const payment = await prisma.payment.create({
      data: {
        clientId: id,
        debtId: data.debtId || null,
        type: data.type,
        amount: data.amount,
        scheduledDate: new Date(data.scheduledDate),
        paidDate,
        status: data.status,
        reference: data.reference || null,
        notes: data.notes || null,
      },
      include: {
        debt: {
          select: { creditorName: true },
        },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
