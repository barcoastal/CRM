import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DialerClient } from "@/components/dialer/dialer-client";
import { Five9Client } from "./five9-client";

interface DialerPageProps {
  searchParams: Promise<{
    campaignId?: string;
    leadId?: string;
  }>;
}

/**
 * Dialer page. When NEXT_PUBLIC_FIVE9_DOMAIN is set we render the Five9
 * Embedded Agent integration; otherwise fall back to the mock dialer
 * (used for dev / when Five9 isn't configured yet).
 */
export default async function DialerPage({ searchParams }: DialerPageProps) {
  await auth();
  const params = await searchParams;

  const five9Domain = process.env.NEXT_PUBLIC_FIVE9_DOMAIN ?? null;
  const five9Station = process.env.NEXT_PUBLIC_FIVE9_DEFAULT_STATION ?? null;

  if (five9Domain) {
    return <Five9Client five9Domain={five9Domain} defaultStation={five9Station} />;
  }

  // Fallback: mock dialer (existing functionality)
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true } } },
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
      initialCampaignId={params.campaignId ?? null}
      initialLeadId={params.leadId ?? null}
    />
  );
}
