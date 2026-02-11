import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      contacts: {
        include: {
          lead: true,
        },
        orderBy: { createdAt: "desc" },
      },
      agents: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const totalContacts = campaign.contacts.length;
  const dialed = campaign.contacts.filter((c) => c.status !== "PENDING").length;
  const connected = campaign.contacts.filter(
    (c) => c.status === "COMPLETED"
  ).length;
  const enrolled = campaign.contacts.filter(
    (c) => c.status === "COMPLETED"
  ).length;
  const remaining = campaign.contacts.filter(
    (c) => c.status === "PENDING"
  ).length;

  return NextResponse.json({
    ...campaign,
    stats: {
      totalContacts,
      dialed,
      connected,
      enrolled,
      remaining,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(campaign);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json(campaign);
}
