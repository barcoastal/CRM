import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createOpportunitySchema } from "@/lib/validations/opportunity";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const search = searchParams.get("search") || "";
  const stage = searchParams.get("stage") || "";
  const assignedToId = searchParams.get("assignedToId") || "";

  const where: Prisma.OpportunityWhereInput = {};

  if (search) {
    where.lead = {
      OR: [
        { businessName: { contains: search } },
        { contactName: { contains: search } },
      ],
    };
  }

  if (stage) {
    where.stage = stage;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            phone: true,
            email: true,
            totalDebtEst: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const serialized = opportunities.map((opp) => ({
    ...opp,
    expectedCloseDate: opp.expectedCloseDate?.toISOString() ?? null,
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  return NextResponse.json({ opportunities: serialized, total, page, totalPages });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createOpportunitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check lead exists
  const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Check no existing opportunity for this lead
  const existing = await prisma.opportunity.findUnique({
    where: { leadId: data.leadId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An opportunity already exists for this lead" },
      { status: 409 }
    );
  }

  // Create opportunity and update lead status in parallel
  const [opportunity] = await Promise.all([
    prisma.opportunity.create({
      data: {
        leadId: data.leadId,
        estimatedValue: typeof data.estimatedValue === "number" ? data.estimatedValue : null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        assignedToId: data.assignedToId || lead.assignedToId || null,
        notes: data.notes || null,
      },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            phone: true,
            email: true,
            totalDebtEst: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.lead.update({
      where: { id: data.leadId },
      data: { status: "OPPORTUNITY" },
    }),
  ]);

  return NextResponse.json({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  }, { status: 201 });
}
