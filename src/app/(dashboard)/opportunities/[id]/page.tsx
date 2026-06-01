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
      debts: {
        include: {
          negotiations: {
            include: {
              negotiator: {
                select: { id: true, name: true },
              },
            },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!opportunity) {
    notFound();
  }

  // Phase 2: Opportunity.lead is now nullable (post-conversion, opp lives on Account).
  // If no lead is attached, redirect to the Account-centric view (built in Phase 2 UI).
  if (!opportunity.lead) {
    notFound();
  }
  const lead = opportunity.lead;

  const serialized = {
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    lead: {
      ...lead,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
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
    },
    debts: opportunity.debts.map((debt) => ({
      ...debt,
      settledDate: debt.settledDate?.toISOString() ?? null,
      lastPaymentDate: debt.lastPaymentDate?.toISOString() ?? null,
      createdAt: debt.createdAt.toISOString(),
      updatedAt: debt.updatedAt.toISOString(),
      negotiations: debt.negotiations.map((neg) => ({
        ...neg,
        date: neg.date.toISOString(),
        createdAt: neg.createdAt.toISOString(),
      })),
    })),
    documents: opportunity.documents.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
    })),
  };

  return <OpportunityDetailTabs opportunity={serialized} />;
}
