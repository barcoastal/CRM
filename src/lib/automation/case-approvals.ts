import { AutomationValidationError } from "./errors";
import type { TriggerCtx } from "@/lib/triggers/types";
import { prisma } from "@/lib/prisma";
import type { Case } from "@/generated/prisma/client";
import { submitForApproval } from "@/lib/approvals/engine";
import { CASE_APPROVAL_PROCESS_ID, caseApprovalEligible } from "./case-policy";

/** Idempotent configuration; never overwrite an administrator's later edits. */
export async function ensureCaseApprovalProcess(db: TriggerCtx["prisma"] = prisma) {
  const existing = await db.approvalProcess.findUnique({ where: { id: CASE_APPROVAL_PROCESS_ID } });
  if (existing) return existing;
  const approvers = await db.group.findUnique({ where: { developerName: "CS_Case_Approvers" } });
  const csL1 = await db.group.findUnique({ where: { developerName: "CS_L1" } });
  if (!approvers || !csL1) throw new AutomationValidationError("Case approval setup requires CS Case Approvers and CS L1 queues.");
  // Live queue membership verified 2026-09-23. Map stable source IDs only;
  // never guess approvers by name or restore memberships after initial setup.
  const users = await db.user.findMany({ where: { isActive: true, OR: [
    { sfId: { startsWith: "0058Y00000CVGxw" } }, // Allison Biscardi
    { sfId: { startsWith: "005VO000000msis" } }, // Yeislee Flores
  ] }, select: { id: true } });
  for (const user of users) {
    await db.groupMember.upsert({ where: { groupId_userId: { groupId: approvers.id, userId: user.id } },
      update: {}, create: { groupId: approvers.id, userId: user.id } });
  }
  const memberCount = await db.groupMember.count({ where: { groupId: approvers.id, user: { isActive: true } } });
  if (!memberCount) throw new AutomationValidationError("No active mapped case approvers. Map the source queue users before enabling approvals.");

  return db.approvalProcess.upsert({
    where: { id: CASE_APPROVAL_PROCESS_ID }, update: {},
    create: {
      id: CASE_APPROVAL_PROCESS_ID, name: "Case Approval Process", entityType: "Case",
      description: "Customer support requests route to CS Case Approvers; approved requests return to CS L1 and rejected requests to the creator.",
      entryCriteria: [],
      finalApprovalActions: [{ kind: "setField", field: "ownerGroupId", value: csL1.id }, { kind: "setField", field: "ownerId", value: null }],
      rejectionActions: [],
      steps: { create: { order: 1, name: "CS Case Approvers", approverGroupIds: [approvers.id] } },
    },
  });
}

export async function prepareCaseApproval(next: Partial<Case>, userId: string | null, db: TriggerCtx["prisma"] = prisma) {
  if (!caseApprovalEligible(next)) return;
  const process = await ensureCaseApprovalProcess(db);
  if (!process.isActive) return;
  const members = await db.groupMember.count({
    where: { group: { developerName: "CS_Case_Approvers" }, user: { isActive: true } },
  });
  if (!members) throw new AutomationValidationError("CS Case Approvers has no active members. Configure the queue before submitting this case.");
  next.ownerId ??= userId;
  if (!next.ownerId) throw new AutomationValidationError("An owner is required to submit this case for approval.");
  next.requiresApproval = true;
}

export async function submitNewCase(row: Case, ctx: TriggerCtx) {
  if (!caseApprovalEligible(row) || !row.requiresApproval || !row.ownerId) return;
  const process = await ctx.prisma.approvalProcess.findUnique({ where: { id: CASE_APPROVAL_PROCESS_ID } });
  if (!process?.isActive) return;
  await submitForApproval({ processId: CASE_APPROVAL_PROCESS_ID, entityType: "Case", entityId: row.id, submitterUserId: row.ownerId }, ctx.prisma, ctx.afterCommit);
}

export async function assertCaseEditable(caseId: string, userId: string | null, db: TriggerCtx["prisma"] = prisma) {
  const pending = await db.approvalRequest.findFirst({
    where: { entityType: "Case", entityId: caseId, processId: CASE_APPROVAL_PROCESS_ID, status: "PENDING" },
    select: { id: true },
  });
  if (!pending) return;
  const user = userId ? await db.user.findUnique({ where: { id: userId }, select: { role: true, profile: { select: { name: true } } } }) : null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role ?? "") && !["System_Administrator", "System Administrator"].includes(user?.profile?.name ?? "")) {
    throw new AutomationValidationError("This case is locked while approval is pending.");
  }
}
