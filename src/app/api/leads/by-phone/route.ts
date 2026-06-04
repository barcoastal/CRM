/**
 * Lookup a Lead by phone number — used by the dialer to load lead context
 * when a call connects.
 *
 *   GET /api/leads/by-phone?phone=5551234567
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

function last10(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("1") && d.length === 11) return d.slice(1);
  return d.length > 10 ? d.slice(-10) : d;
}

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const key = last10(phone);
  const lead = await prisma.lead.findFirst({
    where: { phone: { contains: key } },
    orderBy: { updatedAt: "desc" },
    include: {
      calls: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { id: true, startedAt: true, disposition: true, duration: true },
      },
    },
  });

  if (!lead) return NextResponse.json(null);

  return NextResponse.json({
    id: lead.id,
    contactName: lead.contactName,
    businessName: lead.businessName,
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    totalDebtEst: lead.totalDebtEst,
    industry: lead.industry,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    recentCalls: lead.calls.map((c) => ({
      id: c.id,
      startedAt: c.startedAt.toISOString(),
      disposition: c.disposition,
      duration: c.duration,
    })),
  });
}
