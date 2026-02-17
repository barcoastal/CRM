import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // First, try to list clients
    const clients = await prisma.client.findMany({
      take: 1,
      select: { id: true, leadId: true },
    });

    if (clients.length === 0) {
      return NextResponse.json({ status: "no_clients", clients: [] });
    }

    const clientId = clients[0].id;

    // Now try the full query that the detail page uses
    const client = await prisma.client.findUnique({
      where: { id: clientId },
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
            lastContactedAt: true,
            nextFollowUpAt: true,
            createdAt: true,
            calls: {
              include: {
                agent: { select: { id: true, name: true } },
                campaign: { select: { id: true, name: true } },
              },
              orderBy: { startedAt: "desc" },
            },
            campaignContacts: {
              include: {
                campaign: { select: { id: true, name: true, status: true } },
              },
            },
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
      return NextResponse.json({ status: "not_found", clientId });
    }

    // Test date serialization (this is where runtime errors often happen)
    const testSerialization = {
      programStartDate: typeof client.programStartDate,
      programStartDateValue: String(client.programStartDate),
      hasToISOString: typeof (client.programStartDate as unknown as Date).toISOString === "function",
      createdAt: typeof client.createdAt,
      debtsCount: client.debts.length,
      paymentsCount: client.payments.length,
      documentsCount: client.documents.length,
      leadCallsCount: client.lead.calls.length,
    };

    return NextResponse.json({
      status: "ok",
      clientId,
      testSerialization,
      businessName: client.lead.businessName,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
