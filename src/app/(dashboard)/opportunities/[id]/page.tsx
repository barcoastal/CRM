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
          createdAt: true,
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
      createdAt: opportunity.lead.createdAt.toISOString(),
    },
  };

  return <OpportunityDetailTabs opportunity={serialized} />;
}
