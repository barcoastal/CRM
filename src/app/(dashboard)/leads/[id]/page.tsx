import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeadDetailTabs } from "@/components/leads/lead-detail-tabs";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      calls: {
        include: {
          agent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      campaignContacts: {
        include: {
          campaign: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  // Serialize dates for client component
  const serializedLead = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    calls: lead.calls.map((call) => ({
      ...call,
      startedAt: call.startedAt.toISOString(),
      answeredAt: call.answeredAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      createdAt: call.createdAt.toISOString(),
    })),
    campaignContacts: lead.campaignContacts.map((cc) => ({
      ...cc,
      lastAttempt: cc.lastAttempt?.toISOString() ?? null,
      createdAt: cc.createdAt.toISOString(),
    })),
  };

  return <LeadDetailTabs lead={serializedLead} />;
}
