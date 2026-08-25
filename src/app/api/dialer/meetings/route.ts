import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** GET - all booked meetings (client-scheduled calls), split upcoming vs past. */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const rows = await prisma.scheduledCall.findMany({
    where: { status: { in: ["REQUESTED", "ASSIGNED", "DONE", "CANCELED"] } },
    orderBy: { requestedAt: "desc" },
    take: 500,
  });

  const map = (c: (typeof rows)[number]) => ({
    id: c.id,
    clientName: c.clientName,
    clientEmail: c.clientEmail,
    clientPhone: c.clientPhone,
    debt: c.debt,
    debtLabel: c.debtLabel,
    tier: c.tier,
    requestedAt: c.requestedAt,
    status: c.status,
    closerName: c.closerName,
    opportunityId: c.opportunityId,
    leadId: c.leadId,
  });

  const cutoff = Date.now() - 3600000; // keep a just-passed slot in "upcoming" for an hour
  const upcoming = rows
    .filter((c) => c.requestedAt && c.requestedAt.getTime() >= cutoff)
    .sort((a, b) => (a.requestedAt!.getTime() - b.requestedAt!.getTime()))
    .map(map);
  const past = rows
    .filter((c) => !c.requestedAt || c.requestedAt.getTime() < cutoff)
    .map(map);

  return NextResponse.json({ upcoming, past });
}
