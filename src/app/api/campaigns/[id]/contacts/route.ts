import { recordScope } from "@/lib/record-access";
import { hasPermission } from "@/lib/permissions";
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

  if(!hasPermission(session.user.permissions??[], 'Lead.Edit')) return NextResponse.json({error:'Forbidden'},{status:403});
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const body = await request.json().catch(()=>({}));
  const { leadIds } = body as { leadIds: string[] };

  if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.length > 200 || !leadIds.every(id=>typeof id === "string")) {
    return NextResponse.json(
      { error: "leadIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const permitted=await prisma.lead.count({where:{id:{in:[...new Set(leadIds)]},AND:[await recordScope('lead')]}});
  if(permitted!==new Set(leadIds).size) return NextResponse.json({error:'Some selected leads are unavailable'},{status:403});
  // Find existing contacts to skip duplicates
  const existing = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      leadId: { in: leadIds },
    },
    select: { leadId: true },
  });

  const existingLeadIds = new Set(existing.map((e) => e.leadId));
  const newLeadIds = [...new Set(leadIds)].filter((lid) => !existingLeadIds.has(lid));

  if (newLeadIds.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: leadIds.length,
      message: "All leads are already in the campaign",
    });
  }

  const created = await prisma.campaignContact.createMany({
    skipDuplicates: true,
    data: newLeadIds.map((leadId) => ({
      campaignId,
      leadId,
    })),
  });

  return NextResponse.json({
    added: created.count,
    skipped: leadIds.length - created.count,
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

  if(!hasPermission(session.user.permissions??[], 'Lead.Edit')) return NextResponse.json({error:'Forbidden'},{status:403});
  const { id: campaignId } = await params;
  const body = await request.json().catch(()=>({}));
  const { leadIds } = body as { leadIds: string[] };

  if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.length > 200 || !leadIds.every(id=>typeof id === "string")) {
    return NextResponse.json(
      { error: "leadIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const permitted=await prisma.lead.count({where:{id:{in:[...new Set(leadIds)]},AND:[await recordScope('lead')]}});
  if(permitted!==new Set(leadIds).size) return NextResponse.json({error:'Some selected leads are unavailable'},{status:403});
  const result = await prisma.campaignContact.deleteMany({
    where: {
      campaignId,
      leadId: { in: leadIds },
    },
  });

  return NextResponse.json({ removed: result.count });
}
