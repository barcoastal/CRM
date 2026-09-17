import type { Prisma } from '@/generated/prisma/client';

export const NEGOTIATION_WON_STAGES = ['Closed Won First Payment Pending', 'Closed Won - First Payment Completed'] as const;

/** Client Status drives the account path; isActive also excludes soft-deleted accounts. */
export function negotiationEligibilityWhere(): Prisma.OpportunityWhereInput {
  return { stage: { in: [...NEGOTIATION_WON_STAGES] }, account: { is: { clientStatus: 'Active', isActive: true } } };
}
