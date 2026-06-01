import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import Link from "next/link";
import { Plus } from "lucide-react";

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

  // Phase 2: lead is now nullable on Opportunity. List view shows a placeholder lead
  // for unlinked opps until the Account-based UI is in place.
  const serialized = opportunities
    .filter((opp) => opp.lead != null)
    .map((opp) => ({
      ...opp,
      lead: opp.lead!,
      expectedCloseDate: opp.expectedCloseDate?.toISOString() ?? null,
      createdAt: opp.createdAt.toISOString(),
      updatedAt: opp.updatedAt.toISOString(),
    }));

  return (
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[1.5rem] font-bold tracking-tight"
            style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
          >
            Opportunities
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#444656" }}>
            Track and manage your sales pipeline.
          </p>
        </div>

        <Link
          href="/opportunities/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #0034e4, #3052ff)",
            border: "none",
          }}
        >
          <Plus className="size-4" />
          New Opportunity
        </Link>
      </div>

      {/* ── Table / Kanban ──────────────────────────── */}
      <OpportunityTable
        opportunities={serialized}
        total={total}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
