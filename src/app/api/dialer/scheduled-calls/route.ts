import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** GET - scheduled calls for the floor manager (requested/assigned, upcoming). */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await prisma.scheduledCall.findMany({
    where: { status: { in: ["REQUESTED", "ASSIGNED"] }, requestedAt: { gte: new Date(Date.now() - 3600000) } },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });
  return NextResponse.json({
    rows: rows.map((c) => ({
      id: c.id,
      clientName: c.clientName,
      debt: c.debt,
      debtLabel: c.debtLabel,
      tier: c.tier,
      requestedAt: c.requestedAt,
      status: c.status,
      closerName: c.closerName,
      opportunityId: c.opportunityId,
    })),
  });
}
