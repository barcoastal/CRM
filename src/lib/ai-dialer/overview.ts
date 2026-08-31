import { prisma } from "@/lib/prisma";

export async function getAiDialerOverview() {
  const [campaigns, recentCalls, numbers, googleConnection] = await Promise.all([
    prisma.campaign.findMany({
      where: { dialerMode: "AI" },
      orderBy: { updatedAt: "desc" },
      include: {
        contacts: {
          select: {
            status: true,
            lead: {
              select: {
                status: true,
                aiCallConsent: true,
                aiCallConsentAt: true,
                aiCallConsentSource: true,
                aiCallConsentText: true,
              },
            },
          },
        },
        aiCalls: { select: { status: true, outcome: true } },
      },
    }),
    prisma.aiCall.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { businessName: true, contactName: true, state: true } },
        campaign: { select: { name: true } },
      },
    }),
    prisma.aiOutboundNumber.findMany({
      where: { isActive: true }, orderBy: [{ state: "asc" }, { priority: "desc" }],
    }),
    prisma.integrationCredential.findFirst({
      where: { provider: "GOOGLE_CALENDAR", isActive: true },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    campaigns: campaigns.map((campaign) => {
      const consentReady = campaign.contacts.filter(({ lead }) =>
        lead.status !== "DNC" && lead.aiCallConsent && lead.aiCallConsentAt &&
        lead.aiCallConsentSource && lead.aiCallConsentText,
      ).length;
      const activeCalls = campaign.aiCalls.filter((call) => ["REGISTERED", "IN_PROGRESS"].includes(call.status)).length;
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        aiEnabled: campaign.aiEnabled,
        aiAgentId: campaign.aiAgentId,
        aiMaxConcurrency: campaign.aiMaxConcurrency,
        totalLeads: campaign.contacts.length,
        consentReady,
        pending: campaign.contacts.filter((contact) => contact.status === "PENDING").length,
        activeCalls,
        meetings: campaign.aiCalls.filter((call) => call.outcome === "MEETING_BOOKED").length,
        transfers: campaign.aiCalls.filter((call) => call.outcome === "TRANSFERRED").length,
      };
    }),
    recentCalls: recentCalls.map((call) => ({
      id: call.id,
      retellCallId: call.retellCallId,
      campaignName: call.campaign?.name ?? "—",
      businessName: call.lead.businessName,
      contactName: call.lead.contactName,
      state: call.lead.state,
      status: call.status,
      outcome: call.outcome,
      durationMs: call.durationMs,
      transferred: call.transferred,
      meetingAt: call.meetingAt?.toISOString() ?? null,
      createdAt: call.createdAt.toISOString(),
    })),
    numbers: numbers.map((number) => ({
      id: number.id,
      phoneNumber: number.phoneNumber,
      state: number.state,
      label: number.label,
      priority: number.priority,
    })),
    googleCalendar: googleConnection ? {
      connected: true, name: googleConnection.name, updatedAt: googleConnection.updatedAt.toISOString(),
    } : { connected: false, name: null, updatedAt: null },
  };
}

export type AiDialerOverview = Awaited<ReturnType<typeof getAiDialerOverview>>;
