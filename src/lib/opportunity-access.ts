// src/lib/opportunity-access.ts
/**
 * Archived-opportunity visibility. Closers are not supposed to see archived
 * opportunities (they work active deals only), so they are blocked by default.
 * Everyone else is unaffected. Grant the "Opportunity.ViewArchived" permission
 * (or Modify.AllData) to re-enable archived visibility for a specific closer.
 */
import { prisma } from "@/lib/prisma";
import { loadEffectivePermissions, hasPermission } from "@/lib/permissions";

export const ARCHIVED_STAGE = "ARCHIVED";

export async function canViewArchivedOpportunities(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isCloser: true } });
  if (!user?.isCloser) return true; // only closers are restricted
  const perms = await loadEffectivePermissions(userId);
  return hasPermission(perms, "Opportunity.ViewArchived") || hasPermission(perms, "Modify.AllData");
}
