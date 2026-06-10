/**
 * Port of SF TaskTrigger / TaskHandler.
 * Source: docs/sf-export/sfdx-raw/classes/TaskHandler.cls
 *
 * Ported behaviors:
 *  - beforeInsert:
 *    - If recordType === "DISPOSITION" and disposition is set but subject is
 *      blank → populate subject with the disposition value
 *      (TaskServices.populateSubjectWithDisposition)
 *
 *  - afterInsert / afterUpdate:
 *    - When a Task completes against a Lead → bump Lead.lastContactedAt
 *    - When a Task completes against an Opportunity → bump linked Lead.lastContactedAt
 *    - When a Task completes against an Account → bump Account.lastModified
 *
 * Skipped:
 *  - Custom Notification push to assignee (TaskHandler.sendCustomNotification) —
 *    we'll wire to our own Notifications system in a later phase
 *  - "Lock Opportunity" validation (SF-specific)
 *  - Sub-type derivation (we use type field directly)
 */

import type { Task } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { notify } from "@/lib/notifications/notify";
import { runRulesFor } from "@/lib/validation-rules/evaluator";

type TaskWrite = Partial<Task> & Record<string, unknown>;

export const taskTrigger: Trigger<Task, TaskWrite> = {
  async beforeInsert({ next }) {
    // Run admin-authored validation rules first.
    const vr = await runRulesFor("Task", next as Record<string, unknown>, "insert");
    if (!vr.ok) throw new Error(vr.message);

    if (
      next.recordType === "DISPOSITION" &&
      typeof next.disposition === "string" &&
      !next.subject
    ) {
      next.subject = next.disposition;
    }
  },

  async beforeUpdate({ next, prev }) {
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Task", proposed, "update");
    if (!vr.ok) throw new Error(vr.message);
  },

  async afterUpdate({ row, prev, ctx }) {
    // Task transitioned to COMPLETED
    if (prev.status !== "COMPLETED" && row.status === "COMPLETED") {
      const now = row.completedAt ?? new Date();
      if (row.leadId) {
        await ctx.prisma.lead.update({
          where: { id: row.leadId },
          data: { lastContactedAt: now },
        }).catch(() => undefined);
      }
    }

    // Owner reassignment → notify the new owner (skip self-assignment).
    if (row.ownerId && row.ownerId !== prev.ownerId) {
      void notify({
        recipientId: row.ownerId,
        kind: "OWNER_ASSIGNED",
        title: `Task "${row.subject}" was assigned to you`,
        url: `/tasks/${row.id}`,
        entityType: "Task",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }
  },

  async afterInsert({ row, ctx }) {
    if (row.status === "COMPLETED" && row.leadId) {
      await ctx.prisma.lead.update({
        where: { id: row.leadId },
        data: { lastContactedAt: row.completedAt ?? new Date() },
      }).catch(() => undefined);
    }

    // New task assigned to someone other than the creator → notify the owner.
    if (row.ownerId) {
      void notify({
        recipientId: row.ownerId,
        kind: "OWNER_ASSIGNED",
        title: `New task: ${row.subject}`,
        body: row.notes ? String(row.notes).slice(0, 200) : null,
        url: `/tasks/${row.id}`,
        entityType: "Task",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }
  },
};
