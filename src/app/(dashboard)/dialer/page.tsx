import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DialerClient } from "@/components/dialer/dialer-client";
import { Five9Client } from "./five9-client";

interface DialerPageProps {
  searchParams: Promise<{
    campaignId?: string;
    leadId?: string;
    toolkit?: string;
  }>;
}

/**
 * Dialer page. When NEXT_PUBLIC_FIVE9_DOMAIN is set we render the Five9
 * Embedded Agent integration; otherwise fall back to the mock dialer
 * (used for dev / when Five9 isn't configured yet).
 */
export default async function DialerPage({ searchParams }: DialerPageProps) {
  const session = await auth();
  const params = await searchParams;
  if (process.env.CRM_DIALER_MODE === "twilio") redirect("/call-center");

  const five9Domain = process.env.NEXT_PUBLIC_FIVE9_DOMAIN ?? null;
  const five9Station = process.env.NEXT_PUBLIC_FIVE9_DEFAULT_STATION ?? null;

  if (five9Domain) {
    const pilotEmails = (process.env.FIVE9_FRAME_PILOT_EMAILS ?? "")
      .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
    const pilotEligible = !!session?.user?.email && pilotEmails.includes(session.user.email.toLowerCase());
    const user = session?.user?.id ? await prisma.user.findUnique({
      where: { id: session.user.id }, select: { five9Username: true },
    }) : null;
    return <Five9Client five9Domain={five9Domain} defaultStation={five9Station}
      userId={session?.user?.id} pilotEligible={pilotEligible}
      toolkitMode={pilotEligible && params.toolkit !== "0"}
      expectedFive9Login={user?.five9Username ?? session?.user?.email ?? ""} />;
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
