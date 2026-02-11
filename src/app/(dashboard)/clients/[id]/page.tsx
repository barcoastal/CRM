import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
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
        },
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
      payments: {
        include: {
          debt: {
            select: { creditorName: true },
          },
        },
        orderBy: { scheduledDate: "desc" },
      },
      documents: {
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      assignedNegotiator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!client) {
    notFound();
  }

  // Serialize dates for client component
  const serializedClient = {
    ...client,
    programStartDate: client.programStartDate.toISOString(),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    debts: client.debts.map((debt) => ({
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
    payments: client.payments.map((payment) => ({
      ...payment,
      scheduledDate: payment.scheduledDate.toISOString(),
      paidDate: payment.paidDate?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    documents: client.documents.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
    })),
  };

  return <ClientDetailTabs client={serializedClient} />;
}
