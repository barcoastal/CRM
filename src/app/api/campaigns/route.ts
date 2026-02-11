import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCampaignSchema } from "@/lib/validations/campaign";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            contacts: true,
            agents: true,
          },
        },
        contacts: {
          select: {
            status: true,
          },
        },
      },
    }),
    prisma.campaign.count(),
  ]);

  const campaignsWithStats = campaigns.map((campaign) => {
    const dialed = campaign.contacts.filter(
      (c) => c.status !== "PENDING"
    ).length;
    const connected = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;
    const enrolled = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      dialerMode: campaign.dialerMode,
      status: campaign.status,
      script: campaign.script,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      timezone: campaign.timezone,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      contactCount: campaign._count.contacts,
      agentCount: campaign._count.agents,
      dialed,
      connected,
      enrolled,
      connectedPercent:
        dialed > 0 ? Math.round((connected / dialed) * 100) : 0,
    };
  });

  return NextResponse.json({
    campaigns: campaignsWithStats,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.create({
    data: parsed.data,
  });

  return NextResponse.json(campaign, { status: 201 });
}
