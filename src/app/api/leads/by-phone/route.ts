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
import { splitLeadName } from "@/lib/lead-health-fields";

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
  if (key.length < 7) return ssnSafeJson({ error: "Enter at least 7 digits" }, { status: 400 });

  // Full US numbers use the existing Lead_phone_last10_idx functional index.
  // A suffix LIKE on regexp_replace scans the full leads table and can take
  // tens of seconds. Keep partial-number lookup for the manual search box.
  const rows = key.length === 10
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Lead"
        WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${key}
        ORDER BY "updatedAt" DESC
      `
    : await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Lead"
        WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${"%" + key}
        ORDER BY "updatedAt" DESC
      `;
  const leads = rows.length
    ? await prisma.lead.findMany({
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
    : [];

  return ssnSafeJson({ leads: leads.map(lead => {
    let sf: Record<string, unknown> = {};
    try { sf = JSON.parse(lead.sfDataJson ?? "{}") as Record<string, unknown>; } catch { /* imported record without a valid snapshot */ }
    const source = (key: string) => typeof sf[key] === "string" ? sf[key] as string : null;
    const names = splitLeadName(lead.contactName);
    return {
      id: lead.id,
      sfId: lead.sfId,
      contactName: lead.contactName,
      businessName: lead.businessName,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      brand: lead.brand ?? source("Brand__c"),
      five9Disposition: source("five9_Disposition__c"),
      source: source("LeadSource") ?? lead.source,
      debtRange: source("Estimated_Total_Debt__c"),
      createdAt: lead.createdAt.toISOString(),
      totalDebtEst: lead.totalDebtEst,
      numberOfLenders: lead.numberOfLenders,
      industry: lead.industry ?? source("Industry"),
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      firstName: source("FirstName") ?? names.FirstName,
      lastName: source("LastName") ?? names.LastName,
      alternateEmail: source("Alternate_Email__c"),
      street: source("Street"),
      city: source("City"),
      state: lead.state ?? source("StateCode") ?? source("State"),
      postalCode: source("PostalCode"),
      mobilePhone: source("MobilePhone"),
      workPhone: source("Work_Phone__c"),
      ein: lead.ein ?? source("EIN_Number_Tax_Id__c"),
      utmTerm: lead.utmTerm ?? source("UTM_Term__c"),
      comments: source("pi__comments__c"),
      hasCalendlyEvent: sf.Has_Calendly_Event__c == null ? null :
        sf.Has_Calendly_Event__c === true || sf.Has_Calendly_Event__c === "true",
      recentCalls: lead.calls.map(c => ({
        id: c.id,
        startedAt: c.startedAt.toISOString(),
        disposition: c.disposition,
        duration: c.duration,
      })),
    };
  }) });
}
