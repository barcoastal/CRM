import { enrollInCadence, runCadenceTick } from "@/lib/cadences";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/marketing/postback", () => ({ firePostbackEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/validation-rules/evaluator", () => ({ runRulesFor: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/flow/executor", () => ({ evaluateAndStartFlows: vi.fn().mockResolvedValue(undefined) }));
import { prisma } from "@/lib/prisma";
import { triggerCreate, triggerUpdate } from "@/lib/triggers/runner";
import { approveStep, rejectRequest, recallRequest } from "@/lib/approvals/engine";
import { CASE_APPROVAL_PROCESS_ID } from "@/lib/automation/case-policy";
import type { Case, Prisma } from "@/generated/prisma/client";

const enabled = process.env.RUN_AUTOMATION_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const rollback = new Error("verified rollback");
afterAll(async () => { if (enabled) await prisma.$disconnect(); });

async function withFixture(run: (tx: Prisma.TransactionClient, owner: string, approver: string, csL1: string) => Promise<void>) {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/crm_parity_test") throw new Error("Local parity test database required");
  try {
    await prisma.$transaction(async tx => {
      const owner = await tx.user.create({ data: { name: "Automation fixture owner", email: `automation-owner-${Date.now()}@example.invalid`, passwordHash: "disabled" } });
      const approver = await tx.user.create({ data: { name: "Automation fixture approver", email: `automation-approver-${Date.now()}@example.invalid`, passwordHash: "disabled" } });
      const group = await tx.group.upsert({ where: { developerName: "CS_Case_Approvers" }, update: {}, create: { developerName: "CS_Case_Approvers", name: "CS Case Approvers", type: "QUEUE" } });
      const csL1 = await tx.group.upsert({ where: { developerName: "CS_L1" }, update: {}, create: { developerName: "CS_L1", name: "CS L1", type: "QUEUE" } });
      await tx.groupMember.create({ data: { groupId: group.id, userId: approver.id } });
      await run(tx, owner.id, approver.id, csL1.id);
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) { if (error !== rollback) throw error; }
}

suite("approval transactions against local PostgreSQL", () => {
  it("creates, queues, authorizes, approves, and routes a case without duplicate decisions", async () => {
    await withFixture(async (tx, owner, approver, csL1) => {
      const row = await triggerCreate<Case>("case", { caseNumber: `AUTO-${Date.now()}`, subject: "Refund", recordType: "SUPPORT", type: "Refund", createdById: owner }, { prisma: tx, userId: owner, skip: new Set(), afterCommit: [] });
      const request = await tx.approvalRequest.findFirstOrThrow({ where: { entityId: row.id, processId: CASE_APPROVAL_PROCESS_ID } });
      expect(request.status).toBe("PENDING");
      await expect(triggerUpdate("case", row.id, { status: "CLOSED" }, { prisma: tx, userId: owner, skip: new Set() })).rejects.toThrow("locked");
      expect((await tx.case.findUniqueOrThrow({ where: { id: row.id } })).ownerId).toBeNull();
      await expect(approveStep({ requestId: request.id, actorUserId: owner }, tx)).rejects.toThrow("not an approver");
      await expect(recallRequest({ requestId: request.id, actorUserId: owner }, tx)).rejects.toThrow("Recall is disabled");
      expect(await approveStep({ requestId: request.id, actorUserId: approver }, tx)).toEqual({ status: "APPROVED" });
      const result = await tx.case.findUniqueOrThrow({ where: { id: row.id } });
      expect(result.ownerGroupId).toBe(csL1);
      expect(result.approvedById).toBe(approver);
      await expect(approveStep({ requestId: request.id, actorUserId: approver }, tx)).rejects.toThrow("not pending");
    });
  });
  it("returns rejected cases to the creator", async () => {
    await withFixture(async (tx, owner, approver) => {
      const row = await triggerCreate<Case>("case", { caseNumber: `REJECT-${Date.now()}`, subject: "Skip Payment", recordType: "SUPPORT", type: "Skip Payment", createdById: owner }, { prisma: tx, userId: owner, skip: new Set(), afterCommit: [] });
      const request = await tx.approvalRequest.findFirstOrThrow({ where: { entityId: row.id } });
      await rejectRequest({ requestId: request.id, actorUserId: approver, comments: "Not approved" }, tx);
      const result = await tx.case.findUniqueOrThrow({ where: { id: row.id } });
      expect(result.ownerId).toBe(owner); expect(result.ownerGroupId).toBeNull(); expect(result.approvedAt).toBeNull();
    });
  });
  it("does not submit ordinary support cases", async () => {
    await withFixture(async (tx, owner) => {
      const row = await triggerCreate<Case>("case", { caseNumber: `GENERAL-${Date.now()}`, subject: "Question", recordType: "SUPPORT", type: "General Question", createdById: owner }, { prisma: tx, userId: owner, skip: new Set(), afterCommit: [] });
      expect(await tx.approvalRequest.count({ where: { entityId: row.id } })).toBe(0);
    });
  });
  it("suppresses duplicate enrollments and materializes a contact task exactly once", async () => {
    await withFixture(async (tx, owner) => {
      const cadence = await tx.callCadence.create({ data: { name: `Fixture cadence ${Date.now()}`, steps: { create: { stepOrder: 1, action: "CALL", taskSubject: "Welcome call" } } } });
      const account = await tx.account.create({ data: { name: "Cadence fixture", ownerId: owner } });
      const contact = await tx.contact.create({ data: { firstName: "Test", lastName: "Contact", fullName: "Test Contact" } });
      const when = new Date(Date.now() + 2 * 86_400_000);
      const opp = await tx.opportunity.create({ data: { accountId: account.id, welcomeCallScheduled: when } });
      const db = { callCadence: tx.callCadence, cadenceEnrollment: tx.cadenceEnrollment,
        $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(tx) };
      const args = { cadenceId: cadence.id, opportunityId: opp.id, accountId: account.id, contactId: contact.id,
        enrolledById: owner, automationKey: `welcome-call:${opp.id}`, scheduledFor: when, startAt: new Date(when.getTime() - 86_400_000) };
      const first = await enrollInCadence(args, db);
      expect(await enrollInCadence(args, db)).toEqual(first);
      expect(await tx.cadenceEnrollment.count({ where: { cadenceId: cadence.id } })).toBe(1);
      expect((await runCadenceTick(new Date(), true, db)).processed).toBe(0);
      const due = new Date(when.getTime() - 86_400_000 + 60_000);
      expect((await runCadenceTick(due, true, db)).processed).toBe(1);
      expect((await runCadenceTick(due, true, db)).processed).toBe(0);
      const tasks = await tx.task.findMany({ where: { opportunityId: opp.id } });
      expect(tasks).toHaveLength(1); expect(tasks[0].contactId).toBe(contact.id); expect(tasks[0].ownerId).toBe(owner);
    });
  });

});
