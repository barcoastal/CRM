import type { Lead } from "@/generated/prisma/client";
import type { TriggerCtx } from "@/lib/triggers/types";

// Assign_Web_Leads_to_Seth: source values from the audited active flow.
export const WEB_LEAD_SOURCES = [
  "Web", "Phone Inquiry", "Partner Referral", "Other", "Social", "Google", "Webform",
  "Organic", "Calendly", "Bing", "TB", "LawSuit", "GOOGLE ADS", "Organic M",
  "IB - Social", "IB - Social Spanish", "IB - Google Spanish", "IB - Bing Spanish",
  "Direct Mail", "IB - Youtube", "IB - Bing", "IB - Google", "IB - Debtco", "IB - Organic M",
] as const;

export function snapshot(json: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(json || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export async function applyLeadRouting(
  next: Partial<Lead> & Record<string, unknown>, prev: Lead | undefined, ctx: TriggerCtx,
) {
  const leadSource = next.source === "WEBSITE" ? "Web" : next.source === "MAILER" ? "Direct Mail" : next.source;
  const before = snapshot(prev?.sfDataJson);
  const sf = { ...before, ...snapshot(next.sfDataJson) };
  if (!prev && process.env.DISABLE_WEB_LEAD_ROUTING !== "true" &&
      WEB_LEAD_SOURCES.some(source => source.toLowerCase() === String(leadSource ?? "").toLowerCase())) {
    const owner = await ctx.prisma.user.findFirst({
      where: { email: { equals: process.env.WEB_LEAD_OWNER_EMAIL || "ssweet@coastaldebt.com", mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    // Never replace an existing owner with null when the source user is unmapped.
    if (owner) {
      next.assignedToId = owner.id;
      next.leadAssignmentDate = new Date();
    }
  }
  const fronter = sf.FronterLookup__c;
  if (typeof fronter === "string" && fronter && (!prev || fronter !== before.FronterLookup__c)) {
    const user = await ctx.prisma.user.findFirst({
      where: { OR: [{ id: fronter }, { sfId: fronter }] },
      select: { userCountry: true },
    });
    if (user?.userCountry != null) sf.Agent_Location__c = user.userCountry;
  }
  next.sfDataJson = JSON.stringify(sf);
}
