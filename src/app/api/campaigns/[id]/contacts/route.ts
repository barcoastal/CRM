import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await request.json();
  const { leadIds } = body as { leadIds: string[] };

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json(
      { error: "leadIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Find existing contacts to skip duplicates
  const existing = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      leadId: { in: leadIds },
    },
    select: { leadId: true },
  });

  const existingLeadIds = new Set(existing.map((e) => e.leadId));
  const newLeadIds = leadIds.filter((lid) => !existingLeadIds.has(lid));

  if (newLeadIds.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: leadIds.length,
      message: "All leads are already in the campaign",
    });
  }

  const created = await prisma.campaignContact.createMany({
    data: newLeadIds.map((leadId) => ({
      campaignId,
      leadId,
    })),
  });

  return NextResponse.json({
    added: created.count,
    skipped: leadIds.length - newLeadIds.length,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: campaignId } = await params;
  const body = await request.json();
  const { leadIds } = body as { leadIds: string[] };

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json(
      { error: "leadIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const result = await prisma.campaignContact.deleteMany({
    where: {
      campaignId,
      leadId: { in: leadIds },
    },
  });

  return NextResponse.json({ removed: result.count });
}
