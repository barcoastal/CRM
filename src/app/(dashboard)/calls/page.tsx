import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CallLogTable } from "@/components/calls/call-log-table";

interface CallsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    agentId?: string;
    disposition?: string;
    campaignId?: string;
    direction?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function CallsPage({ searchParams }: CallsPageProps) {
  const session = await auth();
  const params = await searchParams;

  const userRole = (session?.user as { role?: string })?.role;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";

  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 20;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (!isManagerOrAdmin) {
    where.agentId = session?.user?.id;
  } else if (params.agentId) {
    where.agentId = params.agentId;
  }

  if (params.disposition) {
    where.disposition = params.disposition;
  }

  if (params.campaignId) {
    where.campaignId = params.campaignId;
  }

  if (params.direction) {
    where.direction = params.direction;
  }

  if (params.dateFrom || params.dateTo) {
    where.startedAt = {};
    if (params.dateFrom) {
      (where.startedAt as Record<string, unknown>).gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      const end = new Date(params.dateTo);
      end.setHours(23, 59, 59, 999);
      (where.startedAt as Record<string, unknown>).lte = end;
    }
  }

  if (params.search) {
    where.lead = {
      businessName: { contains: params.search },
    };
  }

  const [calls, total, agents, campaigns] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lead: {
          select: { id: true, businessName: true, contactName: true, phone: true },
        },
        agent: { select: { id: true, name: true } },
        feedback: { select: { overallScore: true } },
      },
    }),
    prisma.call.count({ where }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Serialize dates for client component
  const serializedCalls = calls.map((call) => ({
    ...call,
    startedAt: call.startedAt.toISOString(),
    answeredAt: call.answeredAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Call History</h2>
        <p className="text-muted-foreground">
          Browse and filter all call records.
        </p>
      </div>

      <CallLogTable
        calls={serializedCalls}
        total={total}
        page={page}
        totalPages={totalPages}
        agents={agents}
        campaigns={campaigns}
        filters={{
          search: params.search || "",
          agentId: params.agentId || "",
          disposition: params.disposition || "",
          campaignId: params.campaignId || "",
          direction: params.direction || "",
          dateFrom: params.dateFrom || "",
          dateTo: params.dateTo || "",
        }}
      />
    </div>
  );
}
