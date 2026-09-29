import { prisma } from "@/lib/prisma";
import { canAccessRecord } from "@/lib/record-access";

export async function canAccessProgramPlan(id: string) {
  const plan = await prisma.programPlan.findUnique({
    where: { id },
    select: { accountId: true, opportunityId: true },
  });
  return (
    !!plan &&
    ((await canAccessRecord("account", plan.accountId)) ||
      (!!plan.opportunityId &&
        (await canAccessRecord("opportunity", plan.opportunityId))))
  );
}
export async function canAccessDraft(id: string) {
  const draft = await prisma.draft.findUnique({
    where: { id },
    select: { programPlanId: true },
  });
  return !!draft && canAccessProgramPlan(draft.programPlanId);
}
