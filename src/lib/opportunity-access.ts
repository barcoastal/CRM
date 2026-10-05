// src/lib/opportunity-access.ts
/**
 * Archived opportunities are never visible to closers. Other users retain
 * their existing access, including explicit archived-view grants.
 */
import { prisma } from "@/lib/prisma";
import { isCloserUser } from "@/lib/closer-contact-access";

export const ARCHIVED_STAGE = "ARCHIVED";

export const activeOpportunityFilter = {
  NOT: { stage: { startsWith: "archive", mode: "insensitive" as const } },
};

/** An account is archived for a closer when all its linked deals are archived. */
export const activeAccountFilter = {
  isActive: true,
  OR: [
    { opportunities: { none: {} } },
    { opportunities: { some: activeOpportunityFilter } },
  ],
};

export function isArchivedOpportunity(stage: string): boolean {
  return /^archive/i.test(stage);
}

export async function canViewArchivedOpportunities(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true, isCloser: true, closerTier: true,
      profile: { select: { name: true } },
      hierarchyRole: { select: { name: true, developerName: true } },
    },
  });
  return !!user && !isCloserUser(user);
}
