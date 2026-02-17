import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OpportunityDetailTabs } from "@/components/opportunities/opportunity-detail-tabs";

interface OpportunityDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailPageProps) {
  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          ein: true,
          industry: true,
          annualRevenue: true,
          totalDebtEst: true,
          source: true,
          status: true,
          score: true,
          notes: true,
          lastContactedAt: true,
          nextFollowUpAt: true,
          createdAt: true,
          calls: {
            include: {
              agent: { select: { id: true, name: true } },
              campaign: { select: { id: true, name: true } },
            },
            orderBy: { startedAt: "desc" },
          },
          campaignContacts: {
            include: {
              campaign: { select: { id: true, name: true, status: true } },
            },
          },
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true },
      },
    },
  });

  if (!opportunity) {
    notFound();
  }

  const serialized = {
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    lead: {
      ...opportunity.lead,
      lastContactedAt: opportunity.lead.lastContactedAt?.toISOString() ?? null,
      nextFollowUpAt: opportunity.lead.nextFollowUpAt?.toISOString() ?? null,
      createdAt: opportunity.lead.createdAt.toISOString(),
      calls: opportunity.lead.calls.map((call) => ({
        ...call,
        startedAt: call.startedAt.toISOString(),
        answeredAt: call.answeredAt?.toISOString() ?? null,
        endedAt: call.endedAt?.toISOString() ?? null,
        createdAt: call.createdAt.toISOString(),
      })),
      campaignContacts: opportunity.lead.campaignContacts.map((cc) => ({
        ...cc,
        lastAttempt: cc.lastAttempt?.toISOString() ?? null,
        createdAt: cc.createdAt.toISOString(),
      })),
    },
  };

  return <OpportunityDetailTabs opportunity={serialized} />;
}
