import { prisma } from "@/lib/prisma";
import { nextCaseNumber } from "@/lib/cases";
import { auditWrite } from "@/lib/audit";

export interface SkipPaymentArgs {
  programPlanId: string;
  reason: string;
  performedById?: string;
  /** When true (default), the next SCHEDULED Draft is cancelled too. */
  cancelNextDraft?: boolean;
}

export interface SkipPaymentResult {
  caseId: string;
  caseNumber: string;
  cancelledDraftId: string | null;
}

/**
 * Skip-payment workflow: create a SKIP_PAYMENT Case + (by default) cancel
 * the next SCHEDULED Draft on the ProgramPlan. Transactional.
 */
export async function createSkipPaymentCase(args: SkipPaymentArgs): Promise<SkipPaymentResult> {
  const plan = await prisma.programPlan.findUnique({
    where: { id: args.programPlanId },
    include: { account: { select: { id: true } } },
  });
  if (!plan) throw new Error(`ProgramPlan ${args.programPlanId} not found`);

  const caseNumber = await nextCaseNumber();
  const csL1 = await prisma.group.findUnique({ where: { developerName: "CS_L1" } });
  const cancelNextDraft = args.cancelNextDraft !== false;

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.case.create({
      data: {
        caseNumber,
        recordType: "SKIP_PAYMENT",
        subject: `Skip payment request — ${plan.accountId}`,
        description: args.reason,
        status: "NEW",
        priority: "NORMAL",
        origin: "PHONE",
        accountId: plan.account.id,
        programPlanId: plan.id,
        ownerGroupId: csL1?.id ?? null,
        createdById: args.performedById ?? null,
      },
    });

    let cancelledDraftId: string | null = null;
    if (cancelNextDraft) {
      const next = await tx.draft.findFirst({
        where: { programPlanId: plan.id, status: "SCHEDULED" },
        orderBy: { scheduledDate: "asc" },
      });
      if (next) {
        await tx.draft.update({
          where: { id: next.id },
          data: { status: "CANCELLED", notes: `Cancelled by skip-payment case ${caseNumber}` },
        });
        await tx.case.update({ where: { id: created.id }, data: { draftId: next.id } });
        cancelledDraftId = next.id;
      }
    }
    return { caseId: created.id, caseNumber, cancelledDraftId };
  });

  await auditWrite({
    userId: args.performedById ?? null,
    entity: "Case",
    entityId: result.caseId,
    action: "CREATE",
    after: { source: "skip-payment", programPlanId: args.programPlanId, cancelledDraftId: result.cancelledDraftId },
  }).catch(() => null);

  return result;
}
