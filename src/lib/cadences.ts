/**
 * Cadence enrollment + runner.
 *
 * Replaces SF Batch_Five9CallCadence / ScheduleFive9CallCadence with a
 * Postgres-backed runner. A cron hits /api/cadences/run every few minutes
 * to advance enrollments whose nextRunAt is due.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, CadenceStep } from "@/generated/prisma/client";

type CadenceDatabase = Pick<Prisma.TransactionClient, "callCadence" | "cadenceEnrollment"> & {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

/** Enroll a lead/opp/account into a cadence. Step 1 starts after step1.delay. */
export async function enrollInCadence(args: {
  contactId?: string;
  automationKey?: string;
  startAt?: Date;
  scheduledFor?: Date;
  cadenceId: string;
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  enrolledById?: string | null;
}, db: CadenceDatabase = prisma): Promise<{ id: string }> {
  const cadence = await db.callCadence.findUnique({
    where: { id: args.cadenceId },
    include: { steps: { orderBy: { stepOrder: "asc" }, take: 1 } },
  });
  if (!cadence || !cadence.isActive) {
    throw new Error("Cadence not found or inactive");
  }

  const firstStep = cadence.steps[0];
  if (!firstStep) throw new Error("Cadence has no steps");
  const nextRunAt = computeNextRunAt(firstStep, new Date(Math.max(Date.now(), args.startAt?.getTime() ?? 0)));
  // Serialise automatic enrollments by contact/cadence across opportunities.
  // Advisory lock is transaction-local; the unique automation key also guards retries.
  if (args.automationKey) {
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${args.cadenceId + ":" + (args.contactId ?? args.opportunityId)}))::text`;
      const existing = await tx.cadenceEnrollment.findFirst({ where: {
        cadenceId: args.cadenceId, status: { in: ["ACTIVE", "PAUSED"] },
        OR: [{ opportunityId: args.opportunityId }, ...(args.contactId ? [{ contactId: args.contactId }] : [])],
      } });
      if (existing) return { id: existing.id };
      const prior = await tx.cadenceEnrollment.findUnique({ where: { automationKey: args.automationKey } });
      if (prior && (prior.currentStepOrder > 0 || prior.status !== "UNENROLLED")) return { id: prior.id };
      return tx.cadenceEnrollment.upsert({
        where: { automationKey: args.automationKey },
        create: { cadenceId: args.cadenceId, opportunityId: args.opportunityId, accountId: args.accountId,
          contactId: args.contactId, automationKey: args.automationKey, enrolledById: args.enrolledById,
          nextRunAt, scheduledFor: args.scheduledFor },
        update: { status: "ACTIVE", contactId: args.contactId, enrolledById: args.enrolledById, nextRunAt, scheduledFor: args.scheduledFor },
        select: { id: true },
      });
    });
  }

  const enrollment = await db.cadenceEnrollment.create({
    data: {
      cadenceId: cadence.id,
      contactId: args.contactId ?? null,
      leadId: args.leadId ?? null,
      opportunityId: args.opportunityId ?? null,
      accountId: args.accountId ?? null,
      enrolledById: args.enrolledById ?? null,
      status: "ACTIVE",
      currentStepOrder: 0,
      nextRunAt,
    },
  });
  return { id: enrollment.id };
}

function computeNextRunAt(step: CadenceStep, anchor: Date): Date {
  const next = new Date(anchor);
  next.setDate(next.getDate() + step.delayDays);
  next.setHours(next.getHours() + step.delayHours);
  return next;
}

/**
 * Process all enrollments whose nextRunAt is due. Each step is materialized
 * into a Task (for CALL/TASK actions) or EmailMessage/SmsMessage (for
 * EMAIL/SMS actions). The runner then advances to the next step.
 *
 * For WAIT actions we just sleep until the next step.
 */
export async function runCadenceTick(now: Date = new Date(), automatedOnly = false, db: CadenceDatabase = prisma): Promise<{ processed: number; completed: number }> {
  const due = await db.cadenceEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      ...(automatedOnly ? { automationKey: { not: null } } : {}),
    },
    take: 100,
  });

  let processed = 0;
  let completed = 0;

  for (const candidate of due) {
    await db.$transaction(async tx => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "CadenceEnrollment" WHERE id = ${candidate.id} FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return;
      const enrollment = await tx.cadenceEnrollment.findUniqueOrThrow({ where: { id: candidate.id } });
      if (enrollment.status !== "ACTIVE" || !enrollment.nextRunAt || enrollment.nextRunAt > now) return;
      const cadence = await tx.callCadence.findUnique({ where: { id: enrollment.cadenceId } });
      if (!cadence?.isActive) return;
      if (enrollment.automationKey?.startsWith("welcome-call:") && enrollment.opportunityId) {
        const opp = await tx.opportunity.findUnique({ where: { id: enrollment.opportunityId } });
        if (!opp?.welcomeCallScheduled || opp.welcomeCallScheduled.getTime() !== enrollment.scheduledFor?.getTime()) {
          await tx.cadenceEnrollment.update({ where: { id: enrollment.id }, data: { status: "UNENROLLED", nextRunAt: null } });
          return;
        }
      }
      const nextStepOrder = enrollment.currentStepOrder + 1;
      const step = await tx.cadenceStep.findUnique({
        where: { cadenceId_stepOrder: { cadenceId: enrollment.cadenceId, stepOrder: nextStepOrder } },
      });
      if (!step) {
        // No more steps — mark complete
        await tx.cadenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", nextRunAt: null },
        });
        completed++;
        return;
      }

      await materializeStep(enrollment, step, tx);
      processed++;

      // Schedule the next step
      const nextStep = await tx.cadenceStep.findUnique({
        where: { cadenceId_stepOrder: { cadenceId: enrollment.cadenceId, stepOrder: nextStepOrder + 1 } },
      });
      const nextRunAt = nextStep ? computeNextRunAt(nextStep, now) : null;
      await tx.cadenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStepOrder,
          lastStepAt: now,
          nextRunAt,
          status: nextRunAt ? "ACTIVE" : "COMPLETED",
        },
      });
    });
  }

  return { processed, completed };
}

async function materializeStep(enrollment: { contactId?: string | null; id: string; leadId: string | null; opportunityId: string | null; accountId: string | null; enrolledById: string | null }, step: CadenceStep, db: Prisma.TransactionClient): Promise<void> {
  const owner = enrollment.enrolledById;
  switch (step.action) {
    case "CALL":
      await db.task.create({
        data: {
          recordType: "ACTIVITY",
          subject: `Cadence: ${step.taskSubject ?? "Call"}`,
          type: "CALL",
          status: "NOT_STARTED",
          contactId: enrollment.contactId ?? null,
          leadId: enrollment.leadId,
          opportunityId: enrollment.opportunityId,
          accountId: enrollment.accountId,
          ownerId: owner,
          dueDate: new Date(),
          notes: step.callScript ?? null,
        },
      });
      break;
    case "TASK":
      await db.task.create({
        data: {
          recordType: "ACTIVITY",
          subject: step.taskSubject ?? "Cadence Task",
          type: "TASK",
          status: "NOT_STARTED",
          contactId: enrollment.contactId ?? null,
          leadId: enrollment.leadId,
          opportunityId: enrollment.opportunityId,
          accountId: enrollment.accountId,
          ownerId: owner,
          dueDate: new Date(),
        },
      });
      break;
    case "EMAIL":
      // Find recipient email from lead/opp/account
      // Cadence-driven emails are queued; an outbound sender (Phase E) actually delivers them.
      if (!step.emailTemplateId) break;
      const recipient = await findRecipientEmail(enrollment, db);
      if (!recipient) break;
      await db.emailMessage.create({
        data: {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromAddress: "no-reply@coastaldebt.com",
          toAddresses: recipient,
          subject: "(cadence)",
          templateId: step.emailTemplateId,
          contactId: enrollment.contactId ?? null,
          leadId: enrollment.leadId,
          opportunityId: enrollment.opportunityId,
          accountId: enrollment.accountId,
          ownerId: owner,
        },
      });
      break;
    case "SMS":
      if (!step.smsBodyTemplate) break;
      const phone = await findRecipientPhone(enrollment, db);
      if (!phone) break;
      await db.smsMessage.create({
        data: {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromNumber: "+18005551234",
          toNumber: phone,
          body: step.smsBodyTemplate,
          contactId: enrollment.contactId ?? null,
          leadId: enrollment.leadId,
          accountId: enrollment.accountId,
          ownerId: owner,
        },
      });
      break;
    case "WAIT":
      // no-op; the next-step delay handles the wait
      break;
  }
}

async function findRecipientEmail(enrollment: { contactId?: string | null; leadId: string | null; opportunityId: string | null; accountId: string | null }, db: Prisma.TransactionClient): Promise<string | null> {
  if (enrollment.contactId) {
    const contact = await db.contact.findUnique({ where: { id: enrollment.contactId } });
    return contact?.email ?? null;
  }
  if (enrollment.leadId) {
    const lead = await db.lead.findUnique({ where: { id: enrollment.leadId }, select: { email: true } });
    return lead?.email ?? null;
  }
  if (enrollment.opportunityId) {
    const opp = await db.opportunity.findUnique({
      where: { id: enrollment.opportunityId },
      select: { primaryContact: { select: { email: true } } },
    });
    return opp?.primaryContact?.email ?? null;
  }
  if (enrollment.accountId) {
    const acct = await db.account.findUnique({ where: { id: enrollment.accountId }, select: { email: true } });
    return acct?.email ?? null;
  }
  return null;
}

async function findRecipientPhone(enrollment: { contactId?: string | null; leadId: string | null; opportunityId: string | null; accountId: string | null }, db: Prisma.TransactionClient): Promise<string | null> {
  if (enrollment.contactId) {
    const contact = await db.contact.findUnique({ where: { id: enrollment.contactId } });
    return contact?.phone ?? null;
  }
  if (enrollment.leadId) {
    const lead = await db.lead.findUnique({ where: { id: enrollment.leadId }, select: { phone: true } });
    return lead?.phone ?? null;
  }
  if (enrollment.accountId) {
    const acct = await db.account.findUnique({ where: { id: enrollment.accountId }, select: { phone: true } });
    return acct?.phone ?? null;
  }
  return null;
}
