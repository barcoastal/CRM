import { ssnSafeJson } from "@/lib/ssn-safe-json";
/**
 * Lookup a Lead by phone number — used by the dialer to load lead context
 * when a call connects.
 *
 *   GET /api/leads/by-phone?phone=5551234567
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { recordScope } from "@/lib/record-access";

function last10(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("1") && d.length === 11) return d.slice(1);
  return d.length > 10 ? d.slice(-10) : d;
}

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.View");
  if ("response" in r) return r.response;
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return ssnSafeJson({ error: "phone required" }, { status: 400 });

  const key = last10(phone);
  if (!key) return ssnSafeJson(null);

  // Full US numbers use the existing Lead_phone_last10_idx functional index.
  // A suffix LIKE on regexp_replace scans the full leads table and can take
  // tens of seconds. Keep partial-number lookup for the manual search box.
  const rows = key.length === 10
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Lead"
        WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${key}
        ORDER BY "updatedAt" DESC
        LIMIT 50
      `
    : await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Lead"
        WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${"%" + key}
        ORDER BY "updatedAt" DESC
        LIMIT 50
      `;
  const lead = rows.length
    ? await prisma.lead.findFirst({
        where: { id: { in: rows.map(row => row.id) }, AND: [await recordScope("lead")] },
        orderBy: { updatedAt: "desc" },
        include: {
          calls: {
            orderBy: { startedAt: "desc" },
            take: 5,
            select: { id: true, startedAt: true, disposition: true, duration: true },
          },
        },
      })
    : null;

  if (!lead) return ssnSafeJson(null);

  return ssnSafeJson({
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
