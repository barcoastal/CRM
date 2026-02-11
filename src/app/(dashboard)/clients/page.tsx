import { prisma } from "@/lib/prisma";
import { ClientTable } from "@/components/clients/client-table";

interface ClientsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    assignedNegotiatorId?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 20;
  const search = params.search || "";
  const status = params.status || "";
  const assignedNegotiatorId = params.assignedNegotiatorId || "";

  // Build where clause dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (search) {
    where.lead = {
      OR: [
        { businessName: { contains: search } },
        { contactName: { contains: search } },
      ],
    };
  }

  if (status) {
    where.status = status;
  }

  if (assignedNegotiatorId) {
    where.assignedNegotiatorId = assignedNegotiatorId;
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            phone: true,
            email: true,
          },
        },
        assignedNegotiator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Serialize dates for client components
  const serializedClients = clients.map((client) => ({
    ...client,
    programStartDate: client.programStartDate.toISOString(),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">
            Manage enrolled clients and their debt settlement programs.
          </p>
        </div>
      </div>

      <ClientTable
        clients={serializedClients}
        total={total}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
