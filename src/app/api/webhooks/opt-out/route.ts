import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleWebhook } from "@/lib/webhooks";

/**
 * Opt-out / unsubscribe webhook. Expected body:
 *   { email?: string, phone?: string }
 * Marks matching Lead → DNC, Contact.isActive=false (and equivalent for Account).
 * At least one of email|phone must be provided.
 */
export async function POST(req: NextRequest) {
  return handleWebhook({
    req, source: "OPT_OUT",
    endpoint: "/api/webhooks/opt-out",
    secretEnvVar: "OPT_OUT_WEBHOOK_SECRET",
    process: async (payload) => {
      const p = payload as { email?: string; phone?: string };
      if (!p?.email && !p?.phone) return { status: "IGNORED", note: "no email or phone" };

      let updates = 0;
      const orClause: Record<string, string>[] = [];
      if (p.email) orClause.push({ email: p.email });
      if (p.phone) orClause.push({ phone: p.phone });

      const leadsResult = await prisma.lead.updateMany({
        where: { OR: orClause }, data: { status: "DNC" },
      });
      updates += leadsResult.count;

      const contactsResult = await prisma.contact.updateMany({
        where: { OR: orClause }, data: { isActive: false },
      });
      updates += contactsResult.count;

      return { status: "PROCESSED", note: `updated ${updates} records` };
    },
  });
}
