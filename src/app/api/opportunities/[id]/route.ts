import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateOpportunitySchema } from "@/lib/validations/opportunity";
import { validateOppPatch } from "@/lib/validation/opp-validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({
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
          status: true,
          score: true,
          notes: true,
          createdAt: true,
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true },
      },
    },
  });

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    lead: opportunity.lead
      ? { ...opportunity.lead, createdAt: opportunity.lead.createdAt.toISOString() }
      : null,
  });
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

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateOpportunitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // SF validation rules — reject patches that violate ported Opp rules.
  const vErrors = validateOppPatch(
    {
      id: existing.id,
      stage: existing.stage,
      accountId: existing.accountId,
      totalDebt: existing.totalDebt,
      expectedCloseDate: existing.expectedCloseDate,
    },
    {
      stage: typeof data.stage === "string" ? data.stage : undefined,
      totalDebt: typeof data.totalDebt === "number" ? data.totalDebt : (data.totalDebt === null ? null : undefined),
      expectedCloseDate: typeof data.expectedCloseDate === "string" ? data.expectedCloseDate : undefined,
    },
  );
  if (vErrors.length > 0) {
    return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.totalDebt !== undefined) {
    updateData.totalDebt = typeof data.totalDebt === "number" ? data.totalDebt : null;
  }
  if (data.expectedCloseDate !== undefined) {
    updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
  }
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const opportunity = await prisma.opportunity.update({
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
          totalDebtEst: true,
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  });
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

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: { stage: "CLOSED" },
  });

  return NextResponse.json({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  });
}
