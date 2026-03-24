import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DialerClient } from "@/components/dialer/dialer-client";

interface DialerPageProps {
  searchParams: Promise<{
    campaignId?: string;
    leadId?: string;
  }>;
}

export default async function DialerPage({ searchParams }: DialerPageProps) {
  await auth();

  const params = await searchParams;
  const campaignId = params.campaignId ?? null;
  const leadId = params.leadId ?? null;

  // Fetch active campaigns with contact counts
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { contacts: true },
      },
    },
  });

  const campaigns = activeCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    script: c.script,
    contactCount: c._count.contacts,
  }));

  return (
    <DialerClient
      campaigns={campaigns}
      initialCampaignId={campaignId}
      initialLeadId={leadId}
    />
  );
}
