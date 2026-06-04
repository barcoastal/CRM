/**
 * Cadence enrollment + runner.
 *
 * Replaces SF Batch_Five9CallCadence / ScheduleFive9CallCadence with a
 * Postgres-backed runner. A cron hits /api/cadences/run every few minutes
 * to advance enrollments whose nextRunAt is due.
 */

import { prisma } from "@/lib/prisma";
import type { CadenceStep } from "@/generated/prisma/client";

/** Enroll a lead/opp/account into a cadence. Step 1 starts after step1.delay. */
export async function enrollInCadence(args: {
  cadenceId: string;
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  enrolledById?: string | null;
}): Promise<{ id: string }> {
  const cadence = await prisma.callCadence.findUnique({
    where: { id: args.cadenceId },
    include: { steps: { orderBy: { stepOrder: "asc" }, take: 1 } },
  });
  if (!cadence || !cadence.isActive) {
    throw new Error("Cadence not found or inactive");
  }

  const firstStep = cadence.steps[0];
  const nextRunAt = firstStep ? computeNextRunAt(firstStep, new Date()) : null;

  const enrollment = await prisma.cadenceEnrollment.create({
    data: {
      cadenceId: cadence.id,
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
export async function runCadenceTick(now: Date = new Date()): Promise<{ processed: number; completed: number }> {
  const due = await prisma.cadenceEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
    },
    take: 100,
  });

  let processed = 0;
  let completed = 0;

  for (const enrollment of due) {
    const nextStepOrder = enrollment.currentStepOrder + 1;
    const step = await prisma.cadenceStep.findUnique({
      where: { cadenceId_stepOrder: { cadenceId: enrollment.cadenceId, stepOrder: nextStepOrder } },
    });
    if (!step) {
      // No more steps — mark complete
      await prisma.cadenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", nextRunAt: null },
      });
      completed++;
      continue;
    }

    await materializeStep(enrollment, step);
    processed++;

    // Schedule the next step
    const nextStep = await prisma.cadenceStep.findUnique({
      where: { cadenceId_stepOrder: { cadenceId: enrollment.cadenceId, stepOrder: nextStepOrder + 1 } },
    });
    const nextRunAt = nextStep ? computeNextRunAt(nextStep, now) : null;
    await prisma.cadenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepOrder: nextStepOrder,
        lastStepAt: now,
        nextRunAt,
        status: nextRunAt ? "ACTIVE" : "COMPLETED",
      },
    });
  }

  return { processed, completed };
}

async function materializeStep(enrollment: { id: string; leadId: string | null; opportunityId: string | null; accountId: string | null; enrolledById: string | null }, step: CadenceStep): Promise<void> {
  const owner = enrollment.enrolledById;
  switch (step.action) {
    case "CALL":
      await prisma.task.create({
        data: {
          recordType: "ACTIVITY",
          subject: `Cadence: ${step.taskSubject ?? "Call"}`,
          type: "CALL",
          status: "NOT_STARTED",
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
      await prisma.task.create({
        data: {
          recordType: "ACTIVITY",
          subject: step.taskSubject ?? "Cadence Task",
          type: "TASK",
          status: "NOT_STARTED",
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
      const recipient = await findRecipientEmail(enrollment);
      if (!recipient) break;
      await prisma.emailMessage.create({
        data: {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromAddress: "no-reply@coastaldebt.com",
          toAddresses: recipient,
          subject: "(cadence)",
          templateId: step.emailTemplateId,
          leadId: enrollment.leadId,
          opportunityId: enrollment.opportunityId,
          accountId: enrollment.accountId,
          ownerId: owner,
        },
      });
      break;
    case "SMS":
      if (!step.smsBodyTemplate) break;
      const phone = await findRecipientPhone(enrollment);
      if (!phone) break;
      await prisma.smsMessage.create({
        data: {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromNumber: "+18005551234",
          toNumber: phone,
          body: step.smsBodyTemplate,
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

async function findRecipientEmail(enrollment: { leadId: string | null; opportunityId: string | null; accountId: string | null }): Promise<string | null> {
  if (enrollment.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: enrollment.leadId }, select: { email: true } });
    return lead?.email ?? null;
  }
  if (enrollment.opportunityId) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: enrollment.opportunityId },
      select: { primaryContact: { select: { email: true } } },
    });
    return opp?.primaryContact?.email ?? null;
  }
  if (enrollment.accountId) {
    const acct = await prisma.account.findUnique({ where: { id: enrollment.accountId }, select: { email: true } });
    return acct?.email ?? null;
  }
  return null;
}

async function findRecipientPhone(enrollment: { leadId: string | null; opportunityId: string | null; accountId: string | null }): Promise<string | null> {
  if (enrollment.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: enrollment.leadId }, select: { phone: true } });
    return lead?.phone ?? null;
  }
  if (enrollment.accountId) {
    const acct = await prisma.account.findUnique({ where: { id: enrollment.accountId }, select: { phone: true } });
    return acct?.phone ?? null;
  }
  return null;
}
