import { prisma } from "@/lib/prisma";
import { recordScope } from "@/lib/record-access";

/** Prefer explicit relationships. A unique exact company match is only a navigation fallback. */
export async function resolveLeadAccount(lead: {
  id: string;
  sfId: string | null;
  convertedAccountId: string | null;
  businessName: string | null;
  ein: string | null;
  sfDataJson: string | null;
}) {
  const scope = await recordScope("account");
  const select = { id: true, name: true } as const;
  if (lead.convertedAccountId) {
    return prisma.account.findFirst({
      where: { id: lead.convertedAccountId, AND: [scope] },
      select,
    });
  }
  const opp = await prisma.opportunity.findFirst({
    where: {
      AND: [await recordScope("opportunity")],
      accountId: { not: null },
      OR: [
        { leadId: lead.id },
        ...(lead.sfId ? [{ sfLeadIdText: lead.sfId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { accountId: true },
  });
  if (opp?.accountId)
    return prisma.account.findFirst({
      where: { id: opp.accountId, AND: [scope] },
      select,
    });
  let sf: Record<string, unknown> = {};
  try {
    sf = JSON.parse(lead.sfDataJson ?? "{}");
  } catch {
    /* no imported relationship */
  }
  const sfAccountId = sf.ConvertedAccountId ?? sf.Account__c;
  if (typeof sfAccountId === "string" && sfAccountId) {
    const account = await prisma.account.findFirst({
      where: { sfId: sfAccountId, AND: [scope] },
      select,
    });
    if (account) return account;
  }
  const exact = lead.ein?.trim()
    ? { ein: lead.ein.trim() }
    : lead.businessName?.trim()
      ? {
          name: {
            equals: lead.businessName.trim(),
            mode: "insensitive" as const,
          },
        }
      : null;
  if (!exact) return null;
  const matches = await prisma.account.findMany({
    where: { ...exact, AND: [scope] },
    select,
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}
