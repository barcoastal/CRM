import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateClientSchema } from "@/lib/validations/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          ein: true,
          industry: true,
          annualRevenue: true,
          totalDebtEst: true,
          source: true,
        },
      },
      debts: {
        include: {
          negotiations: {
            include: {
              negotiator: {
                select: { id: true, name: true },
              },
            },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { scheduledDate: "desc" },
      },
      documents: {
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      assignedNegotiator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateClientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.programLength !== undefined) updateData.programLength = data.programLength;
  if (data.monthlyPayment !== undefined) updateData.monthlyPayment = data.monthlyPayment;
  if (data.totalEnrolledDebt !== undefined) updateData.totalEnrolledDebt = data.totalEnrolledDebt;
  if (data.totalSettled !== undefined) updateData.totalSettled = data.totalSettled;
  if (data.totalFees !== undefined) updateData.totalFees = data.totalFees;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.assignedNegotiatorId !== undefined) {
    updateData.assignedNegotiatorId = data.assignedNegotiatorId || null;
  }

  const client = await prisma.client.update({
    where: { id },
    data: updateData,
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
        },
      },
      assignedNegotiator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(client);
}
