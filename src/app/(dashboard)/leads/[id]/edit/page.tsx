import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeadEditForm } from "@/components/leads/lead-edit-form";

interface LeadEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadEditPage({ params }: LeadEditPageProps) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  const serializedLead = {
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    ein: lead.ein,
    industry: lead.industry,
    annualRevenue: lead.annualRevenue,
    totalDebtEst: lead.totalDebtEst,
    source: lead.source,
    status: lead.status,
    notes: lead.notes,
    assignedToId: lead.assignedToId,
  };

  return <LeadEditForm lead={serializedLead} />;
}
