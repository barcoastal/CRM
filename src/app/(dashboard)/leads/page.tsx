import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { LeadTable, LeadFilterBar } from "@/components/leads/lead-table";
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
    source: lead.source,
    assignedTo: lead.assignedTo,
    createdAt: lead.createdAt,
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
        source: true,
        createdAt: true,
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    serializedPipelineLeads = pipelineData.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-[26px] font-bold tracking-tight"
          style={{ fontFamily: "var(--font-manrope, 'Manrope', sans-serif)" }}
        >
          Leads
        </h1>
        <div className="flex items-center gap-3">
          <LeadViewToggle />
          {/* Filter icon button */}
          <button
            className="w-10 h-10 flex items-center justify-center rounded-[4px] border-0 cursor-pointer"
            style={{ background: "#f2f3ff", color: "#444656" }}
            title="Filters"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
          <Link
            href="/leads/new"
            className="flex items-center gap-2 px-5 py-2 rounded-[4px] text-white text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#0034e4,#3052ff)",
              textDecoration: "none",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Lead
          </Link>
        </div>
      </div>

      {view === "pipeline" ? (
        <LeadPipeline leads={serializedPipelineLeads} />
      ) : (
        <>
          <LeadFilterBar />
          <LeadTable
            leads={serializedLeads}
            total={total}
            page={page}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
