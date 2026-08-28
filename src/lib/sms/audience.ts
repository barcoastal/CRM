/**
 * Resolve an SMS campaign audience to recipients with phone numbers. Mirrors
 * the email audience helper but keys on phone (last 10 digits) instead of email.
 */
import { prisma } from "@/lib/prisma";
import { buildWhere, type ListFilter } from "@/lib/list-views";

export interface SmsRecipient {
  entityType: "Lead" | "Contact";
  id: string;
  phone: string;
  name: string | null;
  leadId?: string;
  contactId?: string;
  accountId?: string;
  vars: Record<string, string | number | null>;
}

const last10 = (raw: string | null | undefined) => {
  const d = (raw ?? "").replace(/[^0-9]/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

/**
 * Resolve recipients for entity (Lead|Contact), optionally filtered by a saved
 * Segment's filters. Only rows with a phone number are returned, deduped by the
 * last 10 digits.
 */
export async function resolveSmsAudience(opts: { entity: "Lead" | "Contact"; segmentId?: string | null; limit?: number }): Promise<SmsRecipient[]> {
  let filters: ListFilter[] = [];
  let entity = opts.entity;
  if (opts.segmentId) {
    const seg = await prisma.segment.findUnique({ where: { id: opts.segmentId } });
    if (seg) {
      entity = seg.entity === "Contact" ? "Contact" : "Lead";
      filters = (seg.filters as unknown as ListFilter[]) ?? [];
    }
  }
  const filterWhere = buildWhere(filters);
  const take = Math.min(opts.limit ?? 20000, 20000);

  const out: SmsRecipient[] = [];
  const seen = new Set<string>();

  if (entity === "Lead") {
    const rows = await prisma.lead.findMany({
      where: { ...filterWhere, phone: { not: "" } },
      take,
      select: { id: true, phone: true, contactName: true, businessName: true, convertedAccountId: true },
    });
    for (const l of rows) {
      const key = last10(l.phone);
      if (key.length < 10 || seen.has(key)) continue;
      seen.add(key);
      out.push({
        entityType: "Lead", id: l.id, phone: l.phone, name: l.contactName ?? l.businessName ?? null,
        leadId: l.id, accountId: l.convertedAccountId ?? undefined,
        vars: { firstName: l.contactName?.split(" ")[0] ?? "", contactName: l.contactName, businessName: l.businessName },
      });
    }
  } else {
    const rows = await prisma.contact.findMany({
      where: { ...filterWhere, phone: { not: null } },
      take,
      select: { id: true, phone: true, fullName: true, firstName: true, primaryAccountId: true },
    });
    for (const c of rows) {
      const key = last10(c.phone);
      if (key.length < 10 || seen.has(key)) continue;
      seen.add(key);
      out.push({
        entityType: "Contact", id: c.id, phone: c.phone!, name: c.fullName ?? null,
        contactId: c.id, accountId: c.primaryAccountId ?? undefined,
        vars: { firstName: c.firstName ?? c.fullName?.split(" ")[0] ?? "", contactName: c.fullName },
      });
    }
  }
  return out;
}

export async function countSmsAudience(opts: { entity: "Lead" | "Contact"; segmentId?: string | null }): Promise<number> {
  return (await resolveSmsAudience({ ...opts, limit: 20000 })).length;
}
