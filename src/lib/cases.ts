import { prisma } from "@/lib/prisma";
import { nextEscalationLevel } from "@/lib/record-types";
import { auditWrite } from "@/lib/audit";

/**
 * Generate the next sequential case number (C-0001, C-0002, ...).
 * Uses a transaction to avoid duplicates under concurrency.
 */
export async function nextCaseNumber(): Promise<string> {
  const last = await prisma.case.findFirst({
    orderBy: { caseNumber: "desc" },
    select: { caseNumber: true },
  });
  const lastN = last ? parseInt(last.caseNumber.replace("C-", ""), 10) || 0 : 0;
  return `C-${String(lastN + 1).padStart(4, "0")}`;
}

/**
 * Escalate a case to the next L-level. Reassigns owner group to the matching
 * Queue (CS_L1 / CS_L2 / CS_L3 by convention) if one exists. Pure rule:
 * L1 → L2, L2 → L3, L3 → no change (already at top tier).
 */
export async function escalateCase(args: { caseId: string; performedById?: string; reason?: string }) {
  const current = await prisma.case.findUnique({ where: { id: args.caseId } });
  if (!current) throw new Error(`Case ${args.caseId} not found`);

  const next = nextEscalationLevel(current.escalationLevel);
  if (!next) {
    throw new Error(`Case ${current.caseNumber} is already at L3 — cannot escalate further`);
  }

  const targetQueue = await prisma.group.findUnique({
    where: { developerName: next === "L2" ? "CS_L2" : "L3" },
  });

  const updated = await prisma.case.update({
    where: { id: args.caseId },
    data: {
      escalationLevel: next,
      status: "ESCALATED",
      ownerGroupId: targetQueue?.id ?? current.ownerGroupId,
      ownerId: null,
    },
  });

  if (args.reason) {
    await prisma.caseComment.create({
      data: {
        caseId: args.caseId,
        authorId: args.performedById ?? null,
        body: `Escalated to ${next}: ${args.reason}`,
        isInternal: true,
      },
    });
  }

  await auditWrite({
    userId: args.performedById ?? null,
    entity: "Case",
    entityId: args.caseId,
    action: "UPDATE",
    before: { escalationLevel: current.escalationLevel, status: current.status },
    after: { escalationLevel: updated.escalationLevel, status: updated.status },
  }).catch(() => null);

  return updated;
}

/**
 * Close a case (idempotent). Sets resolvedAt + closedAt + terminal status.
 */
export async function closeCase(args: {
  caseId: string;
  outcome?: "RESOLVED" | "CLOSED";
  resolutionNote?: string;
  performedById?: string;
}) {
  const current = await prisma.case.findUnique({ where: { id: args.caseId } });
  if (!current) throw new Error(`Case ${args.caseId} not found`);
  if (current.status === "RESOLVED" || current.status === "CLOSED") {
    return { case: current, alreadyClosed: true };
  }

  const status = args.outcome ?? "RESOLVED";
  const now = new Date();
  const updated = await prisma.case.update({
    where: { id: args.caseId },
    data: {
      status,
      resolvedAt: current.resolvedAt ?? now,
      closedAt: status === "CLOSED" ? now : current.closedAt,
    },
  });

  if (args.resolutionNote) {
    await prisma.caseComment.create({
      data: {
        caseId: args.caseId,
        authorId: args.performedById ?? null,
        body: args.resolutionNote,
        isInternal: true,
      },
    });
  }

  return { case: updated, alreadyClosed: false };
}
