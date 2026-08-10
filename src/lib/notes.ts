import { prisma } from "@/lib/prisma";

/**
 * Unified notes for a lead/opportunity/account chain: every NOTE-type Task
 * attached to any record in the chain, labeled by which record it lives on.
 */

export type NoteSource = "Lead" | "Opportunity" | "Account";

export interface ChainNote {
  id: string;
  body: string;
  source: NoteSource;
  author: string | null;
  createdAt: Date;
}

export async function fetchChainNotes(chain: {
  leadIds?: (string | null | undefined)[];
  opportunityIds?: (string | null | undefined)[];
  accountIds?: (string | null | undefined)[];
}): Promise<ChainNote[]> {
  const leadIds = (chain.leadIds ?? []).filter((v): v is string => !!v);
  const oppIds = (chain.opportunityIds ?? []).filter((v): v is string => !!v);
  const accountIds = (chain.accountIds ?? []).filter((v): v is string => !!v);
  const or: object[] = [];
  if (leadIds.length) or.push({ leadId: { in: leadIds } });
  if (oppIds.length) or.push({ opportunityId: { in: oppIds } });
  if (accountIds.length) or.push({ accountId: { in: accountIds } });
  if (!or.length) return [];

  const rows = await prisma.task.findMany({
    where: { type: "NOTE", OR: or },
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((t) => ({
    id: t.id,
    body: t.notes || t.subject,
    // Precedence: a note attached to the opp is an "Opp note" even when it is
    // also linked to the account (the intake flow links both).
    source: t.opportunityId ? "Opportunity" : t.leadId ? "Lead" : ("Account" as NoteSource),
    author: t.owner?.name ?? null,
    createdAt: t.createdAt,
  }));
}
