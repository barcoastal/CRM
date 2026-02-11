import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateLeadSchema } from "@/lib/validations/lead";

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
