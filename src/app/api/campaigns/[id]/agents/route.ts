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
  const { userIds } = body as { userIds: string[] };

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Find existing agents to skip duplicates
  const existing = await prisma.campaignAgent.findMany({
    where: {
      campaignId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((e) => e.userId));
  const newUserIds = userIds.filter((uid) => !existingUserIds.has(uid));

  if (newUserIds.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: userIds.length,
      message: "All agents are already assigned to the campaign",
    });
  }

  const created = await prisma.campaignAgent.createMany({
    data: newUserIds.map((userId) => ({
      campaignId,
      userId,
    })),
  });

  return NextResponse.json({
    added: created.count,
    skipped: userIds.length - newUserIds.length,
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
  const { userIds } = body as { userIds: string[] };

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const result = await prisma.campaignAgent.deleteMany({
    where: {
      campaignId,
      userId: { in: userIds },
    },
  });

  return NextResponse.json({ removed: result.count });
}
