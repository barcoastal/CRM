import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignDetailClient } from "@/components/campaigns/campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
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
    notFound();
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

  // Serialize dates to strings for the client component
  const serialized = {
    ...campaign,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    contacts: campaign.contacts.map((contact) => ({
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      lastAttempt: contact.lastAttempt?.toISOString() ?? null,
      lead: {
        ...contact.lead,
        createdAt: contact.lead.createdAt.toISOString(),
        updatedAt: contact.lead.updatedAt.toISOString(),
        lastContactedAt: contact.lead.lastContactedAt?.toISOString() ?? null,
        nextFollowUpAt: contact.lead.nextFollowUpAt?.toISOString() ?? null,
      },
    })),
    agents: campaign.agents.map((agent) => ({
      ...agent,
      createdAt: agent.createdAt.toISOString(),
    })),
    stats: {
      totalContacts,
      dialed,
      connected,
      enrolled,
      remaining,
    },
  };

  return <CampaignDetailClient campaign={serialized} />;
}
