import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OpportunityEditForm } from "@/components/opportunities/opportunity-edit-form";

interface OpportunityEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityEditPage({ params }: OpportunityEditPageProps) {
  const { id } = await params;

  const [opportunity, users] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id },
      include: {
        lead: {
          select: { businessName: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!opportunity) {
    notFound();
  }

  const serialized = {
    id: opportunity.id,
    estimatedValue: opportunity.estimatedValue,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    assignedToId: opportunity.assignedToId,
    notes: opportunity.notes,
    lead: opportunity.lead,
  };

  return <OpportunityEditForm opportunity={serialized} users={users} />;
}
