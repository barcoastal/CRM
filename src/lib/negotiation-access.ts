import { prisma } from '@/lib/prisma';
import { negotiationEligibilityWhere } from '@/lib/negotiation-eligibility';

/** Lifecycle eligibility only. Callers must also enforce user/object/record permissions. */
export async function isNegotiationEligible(opportunityId: string): Promise<boolean> {
  return !!await prisma.opportunity.findFirst({ where: { id: opportunityId, ...negotiationEligibilityWhere() }, select: { id: true } });
}
