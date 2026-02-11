import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { createLeadSchema } from "@/lib/validations/lead";

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
  const source = searchParams.get("source") || "";
  const assignedToId = searchParams.get("assignedToId") || "";

  const where: Prisma.LeadWhereInput = {};

  if (search) {
    where.OR = [
      { businessName: { contains: search } },
      { contactName: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (source) {
    where.source = source;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    leads,
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
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const lead = await prisma.lead.create({
    data: {
      businessName: data.businessName,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email || null,
      ein: data.ein || null,
      industry: data.industry || null,
      annualRevenue: typeof data.annualRevenue === "number" ? data.annualRevenue : null,
      totalDebtEst: typeof data.totalDebtEst === "number" ? data.totalDebtEst : null,
      source: data.source,
      notes: data.notes || null,
      assignedToId: data.assignedToId || null,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
