import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";

interface OpportunitiesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    stage?: string;
    assignedToId?: string;
  }>;
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 20;
  const search = params.search || "";
  const stage = params.stage || "";
  const assignedToId = params.assignedToId || "";

  const where: Prisma.OpportunityWhereInput = {};

  if (search) {
    where.lead = {
      OR: [
        { businessName: { contains: search } },
        { contactName: { contains: search } },
      ],
    };
  }

  if (stage) {
    where.stage = stage;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            phone: true,
            email: true,
            totalDebtEst: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const serialized = opportunities.map((opp) => ({
    ...opp,
    expectedCloseDate: opp.expectedCloseDate?.toISOString() ?? null,
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Opportunities</h2>
          <p className="text-muted-foreground">
            Track and manage your sales pipeline.
          </p>
        </div>
      </div>

      <OpportunityTable
        opportunities={serialized}
        total={total}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
