import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createClientSchema } from "@/lib/validations/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const assignedNegotiatorId = searchParams.get("assignedNegotiatorId") || "";

  // Build where clause dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (search) {
    where.lead = {
      OR: [
        { businessName: { contains: search } },
        { contactName: { contains: search } },
      ],
    };
  }

  if (status) {
    where.status = status;
  }

  if (assignedNegotiatorId) {
    where.assignedNegotiatorId = assignedNegotiatorId;
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    clients,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createClientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check if client already exists for this lead
  const existingClient = await prisma.client.findUnique({
    where: { leadId: data.leadId },
  });
  if (existingClient) {
    return NextResponse.json(
      { error: "Client already exists for this lead" },
      { status: 409 }
    );
  }

  // Verify lead exists
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
  });
  if (!lead) {
    return NextResponse.json(
      { error: "Lead not found" },
      { status: 404 }
    );
  }

  const programStart = new Date(data.programStartDate);

  const client = await prisma.client.create({
    data: {
      leadId: data.leadId,
      programStartDate: programStart,
      programLength: data.programLength,
      monthlyPayment: data.monthlyPayment,
      totalEnrolledDebt: data.totalEnrolledDebt,
      assignedNegotiatorId: data.assignedNegotiatorId || null,
    },
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

  // Update lead status to ENROLLED
  await prisma.lead.update({
    where: { id: data.leadId },
    data: { status: "ENROLLED" },
  });

  return NextResponse.json(client, { status: 201 });
}
