/**
 * Current active call for the logged-in agent → drives the dialer screen-pop.
 *
 * Primary source: the always-on Five9 Supervisor feed (real-time, covers
 * outbound, inbound, and transfers). We match the logged-in CRM user to their
 * Five9 agent by username/email, read their live call from the feed, then match
 * the customer name to a CRM lead and return that lead's phone (so the existing
 * by-phone screen-pop works unchanged).
 *
 * Fallback: Call rows written by the Five9 webhook (if the feed is down).
 *
 * GET /api/dialer/active-call
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supervisorFeed } from "@/lib/five9/supervisor-feed";

/** Best-effort match of a Five9 "customer" (often "Last, First") to a CRM lead. */
async function matchLeadByName(customer: string | null): Promise<{ id: string; phone: string | null } | null> {
  if (!customer) return null;
  const commaParts = customer.split(",").map((s) => s.trim()).filter(Boolean);
  const terms = (commaParts.length >= 2 ? commaParts : customer.trim().split(/\s+/))
    .filter((t) => t.length >= 2)
    .slice(0, 3);
  if (!terms.length) return null;
  const lead = await prisma.lead.findFirst({
    where: { AND: terms.map((t) => ({ contactName: { contains: t, mode: "insensitive" as const } })) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, phone: true },
  });
  return lead;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Supervisor feed (real-time, all call directions).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true, email: true },
  });
  const username = user?.five9Username ?? user?.email ?? null;
  const call = supervisorFeed.getCallForUsername(username);
  if (call) {
    const lead = await matchLeadByName(call.customer);
    return NextResponse.json({
      active: true,
      source: "supervisor",
      customer: call.customer,
      callType: call.callType,
      phone: lead?.phone ?? null,
      leadId: lead?.id ?? null,
      onCallSince: call.onCallSince,
    });
  }

  // 2. Fallback: Call rows written by the Five9 webhook.
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const row = await prisma.call.findFirst({
    where: {
      agentId: session.user.id,
      status: { in: ["INITIATED", "IN_PROGRESS"] },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    select: { phoneNumber: true, leadId: true },
  });
  if (row) return NextResponse.json({ active: true, source: "webhook", phone: row.phoneNumber, leadId: row.leadId });

  return NextResponse.json({ active: false });
}
