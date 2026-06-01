import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleWebhook } from "@/lib/webhooks";

/**
 * External lead-source webhook. Expected body shape (minimum):
 *   { businessName, contactName, phone, email?, source?, totalDebtEst?, ... }
 * Auto-assigns recordType=WEB. De-dupe is by phone (same phone → existing lead).
 */
export async function POST(req: NextRequest) {
  return handleWebhook({
    req, source: "LEAD_IMPORT",
    endpoint: "/api/webhooks/lead-import",
    secretEnvVar: "LEAD_IMPORT_API_KEY",
    process: async (payload) => {
      const p = payload as Record<string, unknown>;
      const businessName = (p.businessName as string) ?? "";
      const contactName = (p.contactName as string) ?? "";
      const phone = (p.phone as string) ?? "";
      if (!phone) return { status: "IGNORED", note: "missing phone" };

      const existing = await prisma.lead.findFirst({ where: { phone } });
      if (existing) return { status: "IGNORED", note: `dupe phone, existing lead ${existing.id}` };

      const lead = await prisma.lead.create({
        data: {
          recordType: (p.recordType as string) ?? "WEB",
          businessName: businessName || "(unknown)",
          contactName: contactName || "(unknown)",
          phone,
          email: (p.email as string) ?? null,
          source: (p.source as string) ?? "OTHER",
          industry: (p.industry as string) ?? null,
          annualRevenue: typeof p.annualRevenue === "number" ? p.annualRevenue : null,
          totalDebtEst: typeof p.totalDebtEst === "number" ? p.totalDebtEst : null,
          utmSource: (p.utmSource as string) ?? null,
          utmMedium: (p.utmMedium as string) ?? null,
          utmCampaign: (p.utmCampaign as string) ?? null,
          utmTerm: (p.utmTerm as string) ?? null,
          utmContent: (p.utmContent as string) ?? null,
          gclid: (p.gclid as string) ?? null,
          fbclid: (p.fbclid as string) ?? null,
          eliClickId: (p.eliClickId as string) ?? null,
        },
      });
      return { status: "PROCESSED", note: `created lead ${lead.id}` };
    },
  });
}
