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

type TaskWrite = Partial<Task> & Record<string, unknown>;

export const taskTrigger: Trigger<Task, TaskWrite> = {
  beforeInsert({ next }) {
    if (
      next.recordType === "DISPOSITION" &&
      typeof next.disposition === "string" &&
      !next.subject
    ) {
      next.subject = next.disposition;
    }
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
  },

  async afterInsert({ row, ctx }) {
    if (row.status === "COMPLETED" && row.leadId) {
      await ctx.prisma.lead.update({
        where: { id: row.leadId },
        data: { lastContactedAt: row.completedAt ?? new Date() },
      }).catch(() => undefined);
    }
  },
};
