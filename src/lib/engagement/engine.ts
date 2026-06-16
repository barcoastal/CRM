/**
 * Engagement Sequence engine.
 *
 * Two entry points, both driven by /api/engagement/process:
 *
 *   evaluateAndEnroll() — for each active sequence with a non-empty
 *     entryCriteria, find Lead rows matching the criteria that aren't
 *     already enrolled (unless allowReEnroll). Create new ACTIVE
 *     EngagementEnrollment rows at currentStepOrder=0, nextActionAt=now.
 *
 *   processEnrollments() — find ACTIVE enrollments whose nextActionAt is in
 *     the past, execute the step at currentStepOrder, append to history,
 *     set nextActionAt for the next step (or COMPLETE / EXIT).
 *
 * Step semantics live in executeStep() below. branch_on_open / branch_on_click
 * read EmailMessage.openedAt / firstClickedAt off the lastEmailMessageId set
 * by the previous send_email step.
 *
 * Errors during a step put the enrollment in PAUSED and record the error on
 * history. An admin can resume manually via the API.
 */

import { prisma } from "@/lib/prisma";
import {
  evaluate as evaluateCondition,
  normalizeCondition,
  type Condition,
} from "@/lib/validation-rules/evaluator";
import { sendQueuedEmail } from "@/lib/email-sender";
import { validateStepConfig } from "@/lib/engagement/steps";

type HistoryEntry = {
  at: string;
  stepOrder: number;
  kind: string;
  label: string;
  result: string;
  detail?: Record<string, unknown>;
  error?: string;
};

function appendHistory(prev: unknown, entry: HistoryEntry): HistoryEntry[] {
  const list: HistoryEntry[] = Array.isArray(prev) ? (prev as HistoryEntry[]) : [];
  return [...list, entry];
}

// Prisma's JSON column input doesn't directly accept arrays of an interface
// (the InputJsonObject side wins over InputJsonArray in our generated types).
// Cast through unknown to keep call sites readable.
function historyJson(entries: HistoryEntry[]): object {
  return entries as unknown as object;
}

/* ============ ENROLLMENT ============ */

export async function evaluateAndEnroll(
  options: { sequenceId?: string } = {},
): Promise<{ enrolled: number; sequenceIds: string[] }> {
  const where: { isActive: boolean; entityType: string; id?: string } = {
    isActive: true,
    entityType: "Lead",
  };
  if (options.sequenceId) where.id = options.sequenceId;

  const sequences = await prisma.engagementSequence.findMany({
    where,
    select: {
      id: true,
      entityType: true,
      entryCriteria: true,
      allowReEnroll: true,
      maxEnrollsPerTick: true,
    },
  });

  let enrolled = 0;
  const ranSequenceIds: string[] = [];

  for (const seq of sequences) {
    let cond: Condition;
    try {
      cond = normalizeCondition(seq.entryCriteria);
    } catch {
      continue;
    }
    if (cond.conditions.length === 0) {
      // Empty criteria — don't auto-enroll; manual enroll only.
      continue;
    }
    ranSequenceIds.push(seq.id);

    // Naive scan: load leads in pages, evaluate in-process. Production-safe
    // because conditions are arbitrary and we already pre-cap with the rate
    // limit. For very large lead tables this can be optimized to SQL later.
    const PAGE = 500;
    let cursor: string | undefined;
    let createdForSeq = 0;

    while (createdForSeq < seq.maxEnrollsPerTick) {
      const leads = await prisma.lead.findMany({
        where: cursor ? { id: { gt: cursor } } : {},
        orderBy: { id: "asc" },
        take: PAGE,
      });
      if (leads.length === 0) break;
      cursor = leads[leads.length - 1].id;

      // Existing enrollments for this sequence — used to filter when
      // allowReEnroll is false. Pull in one query per page.
      let existingMap = new Map<string, true>();
      if (!seq.allowReEnroll) {
        const existing = await prisma.engagementEnrollment.findMany({
          where: {
            sequenceId: seq.id,
            entityType: "Lead",
            entityId: { in: leads.map((l) => l.id) },
          },
          select: { entityId: true },
        });
        existingMap = new Map(existing.map((e) => [e.entityId, true as const]));
      }

      for (const lead of leads) {
        if (createdForSeq >= seq.maxEnrollsPerTick) break;
        if (!seq.allowReEnroll && existingMap.has(lead.id)) continue;
        let matched = false;
        try {
          matched = evaluateCondition(cond, lead as unknown as Record<string, unknown>);
        } catch {
          matched = false;
        }
        if (!matched) continue;
        try {
          await prisma.engagementEnrollment.create({
            data: {
              sequenceId: seq.id,
              entityType: "Lead",
              entityId: lead.id,
              status: "ACTIVE",
              currentStepOrder: 0,
              nextActionAt: new Date(),
              history: [],
            },
          });
          createdForSeq++;
        } catch {
          // Unique constraint — already enrolled at this exact enteredAt;
          // safe to skip.
          continue;
        }
      }

      if (leads.length < PAGE) break;
    }

    if (createdForSeq > 0) {
      enrolled += createdForSeq;
      await prisma.engagementSequence.update({
        where: { id: seq.id },
        data: { totalEnrolled: { increment: createdForSeq } },
      });
    }
  }

  return { enrolled, sequenceIds: ranSequenceIds };
}

/** Manually enroll one lead into a sequence. Bypasses entryCriteria. */
export async function enrollLeadManually(args: {
  sequenceId: string;
  leadId: string;
}): Promise<{ ok: true; enrollmentId: string } | { ok: false; error: string }> {
  const seq = await prisma.engagementSequence.findUnique({
    where: { id: args.sequenceId },
    select: { id: true, allowReEnroll: true, isActive: true },
  });
  if (!seq) return { ok: false, error: "Sequence not found" };
  if (!seq.isActive) return { ok: false, error: "Sequence is inactive" };

  if (!seq.allowReEnroll) {
    const existing = await prisma.engagementEnrollment.findFirst({
      where: { sequenceId: seq.id, entityType: "Lead", entityId: args.leadId },
      select: { id: true, status: true },
    });
    if (existing) {
      return { ok: false, error: `Lead is already enrolled (status ${existing.status})` };
    }
  }

  const created = await prisma.engagementEnrollment.create({
    data: {
      sequenceId: seq.id,
      entityType: "Lead",
      entityId: args.leadId,
      status: "ACTIVE",
      currentStepOrder: 0,
      nextActionAt: new Date(),
      history: [],
    },
  });
  await prisma.engagementSequence.update({
    where: { id: seq.id },
    data: { totalEnrolled: { increment: 1 } },
  });
  return { ok: true, enrollmentId: created.id };
}

/* ============ PROCESSING ============ */

export async function processEnrollments(
  options: { limit?: number; sequenceId?: string } = {},
): Promise<{ processed: number; advanced: number; completed: number; errored: number }> {
  const limit = options.limit ?? 200;
  const where: {
    status: string;
    nextActionAt: { lte: Date };
    sequenceId?: string;
  } = {
    status: "ACTIVE",
    nextActionAt: { lte: new Date() },
  };
  if (options.sequenceId) where.sequenceId = options.sequenceId;

  const due = await prisma.engagementEnrollment.findMany({
    where,
    orderBy: { nextActionAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let advanced = 0;
  let completed = 0;
  let errored = 0;

  for (const enr of due) {
    processed++;
    try {
      const r = await executeStep(enr.id);
      if (r === "advanced") advanced++;
      else if (r === "completed" || r === "exited") completed++;
      else if (r === "errored") errored++;
    } catch (e) {
      errored++;
      // Defensive — mark paused with the error so we don't spin.
      await prisma.engagementEnrollment.update({
        where: { id: enr.id },
        data: {
          status: "PAUSED",
          history: historyJson(appendHistory(enr.history, {
            at: new Date().toISOString(),
            stepOrder: enr.currentStepOrder,
            kind: "system",
            label: "executeStep crashed",
            result: "ERROR",
            error: e instanceof Error ? e.message : String(e),
          })),
        },
      });
    }
  }

  return { processed, advanced, completed, errored };
}

/**
 * Execute the step at the enrollment's currentStepOrder. Returns a coarse
 * tag describing what happened so the caller can keep counts.
 */
async function executeStep(
  enrollmentId: string,
): Promise<"advanced" | "completed" | "exited" | "errored" | "paused"> {
  const enr = await prisma.engagementEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      sequence: {
        select: {
          id: true,
          steps: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!enr) return "errored";
  if (enr.status !== "ACTIVE") return "errored";

  const steps = enr.sequence.steps;
  // currentStepOrder is 0-based — order 0 = first step. The schema stores
  // EngagementStep.order as the same 0-based value to keep the model simple.
  if (steps.length === 0 || enr.currentStepOrder >= steps.length) {
    await markCompleted(enr.id, enr.sequence.id, enr.history, "no more steps");
    return "completed";
  }

  const step = steps[enr.currentStepOrder];
  const cfgRes = validateStepConfig(step.kind, step.config);
  if (!cfgRes.ok) {
    await prisma.engagementEnrollment.update({
      where: { id: enr.id },
      data: {
        status: "PAUSED",
        history: historyJson(appendHistory(enr.history, {
          at: new Date().toISOString(),
          stepOrder: enr.currentStepOrder,
          kind: step.kind,
          label: step.label,
          result: "INVALID_CONFIG",
          error: cfgRes.error,
        })),
      },
    });
    return "paused";
  }

  let nextStepOrder = enr.currentStepOrder + 1;
  let nextActionAt: Date | null = new Date();
  let result = "OK";
  let detail: Record<string, unknown> | undefined;
  let errorMsg: string | undefined;
  let newLastEmailMessageId: string | null | undefined;

  try {
    switch (step.kind) {
      case "send_email": {
        const cfg = cfgRes.config as { templateId: string; fromUserId?: string };
        if (enr.entityType !== "Lead") throw new Error("Only Lead is supported in v1");
        const lead = await prisma.lead.findUnique({
          where: { id: enr.entityId },
          select: { id: true, email: true },
        });
        if (!lead?.email) {
          result = "SKIPPED_NO_EMAIL";
          detail = { reason: "Lead has no email address" };
          break;
        }
        const template = await prisma.emailTemplate.findUnique({
          where: { id: cfg.templateId },
          select: { id: true, subject: true },
        });
        if (!template) throw new Error("Template not found");

        let fromAddress = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
        if (cfg.fromUserId) {
          const u = await prisma.user.findUnique({
            where: { id: cfg.fromUserId },
            select: { name: true, email: true },
          });
          if (u?.email) fromAddress = `${u.name ?? u.email} <${u.email}>`;
        }

        const msg = await prisma.emailMessage.create({
          data: {
            direction: "OUTBOUND",
            status: "QUEUED",
            fromAddress,
            toAddresses: lead.email,
            subject: template.subject || "",
            templateId: template.id,
            leadId: lead.id,
            provider: "RESEND",
          },
        });
        // Fire and forget — the queue drainer will retry on transient
        // failures. We capture the id either way so branch_on_open can see
        // it once tracking events arrive.
        void sendQueuedEmail(msg.id).catch(() => undefined);
        newLastEmailMessageId = msg.id;
        detail = { emailMessageId: msg.id, to: lead.email };
        // Continuation is immediate. Branch steps later read this message id.
        break;
      }
      case "wait": {
        const cfg = cfgRes.config as { days?: number; hours?: number };
        const ms = ((cfg.days ?? 0) * 24 + (cfg.hours ?? 0)) * 60 * 60 * 1000;
        nextActionAt = new Date(Date.now() + ms);
        detail = { waitMs: ms };
        break;
      }
      case "branch_on_open":
      case "branch_on_click": {
        const cfg = cfgRes.config as {
          yesGoToStepOrder: number;
          noGoToStepOrder: number;
          waitHours: number;
        };
        let opened = false;
        if (enr.lastEmailMessageId) {
          const msg = await prisma.emailMessage.findUnique({
            where: { id: enr.lastEmailMessageId },
            select: { openedAt: true, firstClickedAt: true },
          });
          opened = step.kind === "branch_on_open"
            ? !!msg?.openedAt
            : !!msg?.firstClickedAt;
        }
        const target = opened ? cfg.yesGoToStepOrder : cfg.noGoToStepOrder;
        nextStepOrder = target > 0 && target <= steps.length ? target - 1 : steps.length;
        nextActionAt = new Date(Date.now() + cfg.waitHours * 60 * 60 * 1000);
        detail = {
          opened,
          taken: opened ? "yes" : "no",
          gotoStepOrder: nextStepOrder,
        };
        break;
      }
      case "update_score": {
        const cfg = cfgRes.config as { delta: number };
        if (enr.entityType !== "Lead") throw new Error("Only Lead is supported in v1");
        await prisma.lead.update({
          where: { id: enr.entityId },
          data: { score: { increment: cfg.delta } },
        });
        detail = { delta: cfg.delta };
        break;
      }
      case "add_to_list": {
        const cfg = cfgRes.config as { listId: string };
        if (enr.entityType !== "Lead") throw new Error("Only Lead is supported in v1");
        await prisma.leadListMember.upsert({
          where: { listId_leadId: { listId: cfg.listId, leadId: enr.entityId } },
          create: { listId: cfg.listId, leadId: enr.entityId, source: "sequence" },
          update: {},
        });
        detail = { listId: cfg.listId };
        break;
      }
      case "remove_from_list": {
        const cfg = cfgRes.config as { listId: string };
        if (enr.entityType !== "Lead") throw new Error("Only Lead is supported in v1");
        await prisma.leadListMember.deleteMany({
          where: { listId: cfg.listId, leadId: enr.entityId },
        });
        detail = { listId: cfg.listId };
        break;
      }
      case "task": {
        const cfg = cfgRes.config as {
          subject: string;
          dueOffsetDays?: number;
          ownerUserId?: string;
        };
        const dueDate = cfg.dueOffsetDays != null
          ? new Date(Date.now() + cfg.dueOffsetDays * 24 * 60 * 60 * 1000)
          : null;
        const task = await prisma.task.create({
          data: {
            subject: cfg.subject,
            type: "TASK",
            status: "NOT_STARTED",
            leadId: enr.entityType === "Lead" ? enr.entityId : null,
            ownerId: cfg.ownerUserId ?? null,
            dueDate,
          },
        });
        detail = { taskId: task.id };
        break;
      }
      case "exit": {
        await markCompleted(enr.id, enr.sequence.id, enr.history, "exit step", true);
        return "exited";
      }
      default:
        throw new Error(`Unknown step kind: ${step.kind}`);
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
    result = "ERROR";
  }

  const history = appendHistory(enr.history, {
    at: new Date().toISOString(),
    stepOrder: enr.currentStepOrder,
    kind: step.kind,
    label: step.label,
    result,
    detail,
    error: errorMsg,
  });

  const historyForDb = historyJson(history);
  if (errorMsg) {
    await prisma.engagementEnrollment.update({
      where: { id: enr.id },
      data: { status: "PAUSED", history: historyForDb },
    });
    return "errored";
  }

  // If the next pointer landed past the last step, mark completed.
  if (nextStepOrder >= steps.length) {
    const updated = await prisma.engagementEnrollment.update({
      where: { id: enr.id },
      data: {
        history: historyForDb,
        status: "COMPLETED",
        finishedAt: new Date(),
        nextActionAt: null,
        currentStepOrder: nextStepOrder,
        ...(newLastEmailMessageId !== undefined
          ? { lastEmailMessageId: newLastEmailMessageId }
          : {}),
      },
    });
    await prisma.engagementSequence.update({
      where: { id: updated.sequenceId },
      data: { totalCompleted: { increment: 1 } },
    });
    return "completed";
  }

  await prisma.engagementEnrollment.update({
    where: { id: enr.id },
    data: {
      history: historyForDb,
      currentStepOrder: nextStepOrder,
      nextActionAt,
      ...(newLastEmailMessageId !== undefined
        ? { lastEmailMessageId: newLastEmailMessageId }
        : {}),
    },
  });
  return "advanced";
}

async function markCompleted(
  enrollmentId: string,
  sequenceId: string,
  prevHistory: unknown,
  reason: string,
  isExit: boolean = false,
): Promise<void> {
  await prisma.engagementEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: isExit ? "EXITED" : "COMPLETED",
      finishedAt: new Date(),
      nextActionAt: null,
      history: historyJson(appendHistory(prevHistory, {
        at: new Date().toISOString(),
        stepOrder: -1,
        kind: "system",
        label: isExit ? "Exit" : "Sequence complete",
        result: "OK",
        detail: { reason },
      })),
    },
  });
  await prisma.engagementSequence.update({
    where: { id: sequenceId },
    data: isExit
      ? { totalExited: { increment: 1 } }
      : { totalCompleted: { increment: 1 } },
  });
}
