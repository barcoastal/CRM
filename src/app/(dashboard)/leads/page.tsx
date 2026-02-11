import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadPipeline } from "@/components/leads/lead-pipeline";
import { LeadViewToggle } from "@/components/leads/lead-view-toggle";

interface LeadsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    source?: string;
    assignedToId?: string;
    view?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 20;
  const search = params.search || "";
  const status = params.status || "";
  const source = params.source || "";
  const assignedToId = params.assignedToId || "";
  const view = params.view || "table";

  const where: Prisma.LeadWhereInput = {};

  if (search) {
    where.OR = [
      { businessName: { contains: search } },
      { contactName: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (source) {
    where.source = source;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Serialize dates for client components
  const serializedLeads = leads.map((lead) => ({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
  }));

  // For pipeline view, fetch all leads (not paginated) for the pipeline columns
  let serializedPipelineLeads = serializedLeads.map((lead) => ({
    id: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    totalDebtEst: lead.totalDebtEst,
    score: lead.score,
    status: lead.status,
  }));

  if (view === "pipeline") {
    const pipelineData = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        totalDebtEst: true,
        score: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    serializedPipelineLeads = pipelineData;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">
            Manage and track your business leads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LeadViewToggle />
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="size-4" />
              Add Lead
            </Link>
          </Button>
        </div>
      </div>

      {view === "pipeline" ? (
        <LeadPipeline leads={serializedPipelineLeads} />
      ) : (
        <LeadTable
          leads={serializedLeads}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
