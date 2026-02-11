import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateLeadSchema } from "@/lib/validations/lead";
import { enrollClientSchema } from "@/lib/validations/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      calls: {
        include: {
          agent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      campaignContacts: {
        include: {
          campaign: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(lead);
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

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const body = await request.json();

  // Handle enrollment flow: status=ENROLLED + enrollmentData
  if (body.status === "ENROLLED" && body.enrollmentData) {
    const enrollParsed = enrollClientSchema.safeParse(body.enrollmentData);
    if (!enrollParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: enrollParsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if client already exists for this lead
    const existingClient = await prisma.client.findUnique({
      where: { leadId: id },
    });
    if (existingClient) {
      return NextResponse.json(
        { error: "Client already exists for this lead" },
        { status: 409 }
      );
    }

    const enrollData = enrollParsed.data;
    const programStart = new Date(enrollData.programStartDate);

    // Update lead status and create client in a transaction
    const [lead, client] = await Promise.all([
      prisma.lead.update({
        where: { id },
        data: { status: "ENROLLED" },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.client.create({
        data: {
          leadId: id,
          programStartDate: programStart,
          programLength: enrollData.programLength,
          monthlyPayment: enrollData.monthlyPayment,
          totalEnrolledDebt: enrollData.totalEnrolledDebt,
          assignedNegotiatorId: enrollData.assignedNegotiatorId || null,
        },
      }),
    ]);

    // Auto-generate payment schedule
    const payments = [];
    for (let i = 0; i < enrollData.programLength; i++) {
      const scheduledDate = new Date(programStart);
      scheduledDate.setMonth(scheduledDate.getMonth() + i);
      payments.push({
        clientId: client.id,
        type: "CLIENT_PAYMENT",
        amount: enrollData.monthlyPayment,
        scheduledDate,
        status: "SCHEDULED",
      });
    }
    if (payments.length > 0) {
      await prisma.payment.createMany({ data: payments });
    }

    return NextResponse.json({ ...lead, clientId: client.id });
  }

  // Standard lead update
  const parsed = updateLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const updateData: Record<string, unknown> = {};

  if (data.businessName !== undefined) updateData.businessName = data.businessName;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.ein !== undefined) updateData.ein = data.ein || null;
  if (data.industry !== undefined) updateData.industry = data.industry || null;
  if (data.annualRevenue !== undefined) {
    updateData.annualRevenue = typeof data.annualRevenue === "number" ? data.annualRevenue : null;
  }
  if (data.totalDebtEst !== undefined) {
    updateData.totalDebtEst = typeof data.totalDebtEst === "number" ? data.totalDebtEst : null;
  }
  if (data.source !== undefined) updateData.source = data.source;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
  if (data.score !== undefined) updateData.score = data.score;
  if (data.nextFollowUpAt !== undefined) {
    updateData.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(lead);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: { status: "LOST" },
  });

  return NextResponse.json(lead);
}
