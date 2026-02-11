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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dialer</h2>
        <p className="text-muted-foreground">
          Power dial through your campaign contacts.
        </p>
      </div>
      <DialerClient
        campaigns={campaigns}
        initialCampaignId={campaignId}
        initialLeadId={leadId}
      />
    </div>
  );
}
