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
  const r = await requireAuthOrRespond("Lead.View");
  if ("response" in r) return r.response;
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const key = last10(phone);
  if (!key) return NextResponse.json(null);

  // Match on DIGITS, not the raw stored string: strip all non-digits from the
  // stored phone and test that it ends with the incoming digits. This handles
  // any stored formatting ("1(800)-864-8331", "(800) 864 8331", etc.) and a
  // leading country-code "1". `key` is digits-only, so it is LIKE-wildcard safe.
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Lead"
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${"%" + key}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  const match = rows[0];
  const lead = match
    ? await prisma.lead.findUnique({
        where: { id: match.id },
        include: {
          calls: {
            orderBy: { startedAt: "desc" },
            take: 5,
            select: { id: true, startedAt: true, disposition: true, duration: true },
          },
        },
      })
    : null;

  if (!lead) return NextResponse.json(null);

  return NextResponse.json({
    id: lead.id,
    contactName: lead.contactName,
    businessName: lead.businessName,
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    totalDebtEst: lead.totalDebtEst,
    numberOfLenders: lead.numberOfLenders,
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
