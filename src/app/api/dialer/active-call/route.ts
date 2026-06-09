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

/** Last 10 digits of a phone string, for loose matching. */
function digits10(s: string): string {
  const d = s.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * Best-effort match of a Five9 "customer" to a CRM lead.
 * For outbound calls the customer is the dialed phone number; for inbound/campaign
 * calls it is often a contact name ("Last, First"). Try phone first when numeric.
 */
async function matchLead(customer: string | null): Promise<{ id: string; phone: string | null } | null> {
  if (!customer) return null;
  const trimmed = customer.trim();

  // Phone match: if the customer is mostly digits, match a lead by last-10-digits.
  const numeric = trimmed.replace(/\D/g, "");
  if (numeric.length >= 7 && /^[\d\s+()-]+$/.test(trimmed)) {
    const last10 = digits10(trimmed);
    const byPhone = await prisma.lead.findFirst({
      where: { phone: { contains: last10 } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, phone: true },
    });
    if (byPhone) return byPhone;
    return null; // numeric customer that matches no lead — don't fall through to name terms
  }

  // Name match: split "Last, First" (or whitespace) and require all terms in contactName.
  const commaParts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const terms = (commaParts.length >= 2 ? commaParts : trimmed.split(/\s+/))
    .filter((t) => t.length >= 2)
    .slice(0, 3);
  if (!terms.length) return null;
  return prisma.lead.findFirst({
    where: { AND: terms.map((t) => ({ contactName: { contains: t, mode: "insensitive" as const } })) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, phone: true },
  });
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
    const lead = await matchLead(call.customer);
    // For outbound the customer IS the dialed number — pop it even if no lead matched.
    const customerIsPhone = !!call.customer && /^[\d\s+()-]+$/.test(call.customer) && call.customer.replace(/\D/g, "").length >= 7;
    return NextResponse.json({
      active: true,
      source: "supervisor",
      customer: call.customer,
      callType: call.callType,
      phone: lead?.phone ?? (customerIsPhone ? call.customer : null),
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
