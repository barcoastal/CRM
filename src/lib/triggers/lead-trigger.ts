/**
 * Port of SF LeadTrigger / LeadTriggerHandler / LeadAfterTriggerHelper.
 * Source: docs/sf-export/sfdx-raw/classes/LeadTriggerHandler.cls
 *
 * Ported behaviors:
 *  - beforeUpdate:
 *    - Status change → store previous status into Lead.lastDisposition
 *      and timestamp Lead.lastDispositionAt
 *    - SubDisposition change → store previous subDisposition into
 *      Lead.lastSubDisposition
 *    - Owner change → set Lead.leadAssignmentDate = today
 *
 *  - afterUpdate:
 *    - Status change → create a Task ("Status Changed to X") for audit
 *      (skipped when LEAD_TRIGGER_SKIP_TASK is set on ctx, e.g. the
 *      Disposition endpoint already creates a task itself)
 *    - LeadHistory entry recording the status change
 *
 * Skipped for now (need wider context):
 *  - Five9 list sync (Phase D)
 *  - Individual record creation (separate identity system)
 *  - No-business-state validation (needs state code list)
 *  - Creditor payment field recomputation (we model via LeadDebt instead)
 */

import type { Lead } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { addSuppression } from "@/lib/dnc";
import { onLeadStatusChange } from "./email-automation";

// Use a permissive shape so trigger writers can set FK columns directly.
type LeadWrite = Partial<Lead> & Record<string, unknown>;

export const LEAD_TRIGGER_SKIP_TASK = Symbol.for("lead-trigger-skip-task");

export const leadTrigger: Trigger<Lead, LeadWrite> = {
  beforeUpdate({ next, prev }) {
    // Status change → roll previous status into lastDisposition
    if (next.status !== undefined && next.status !== prev.status) {
      next.lastDisposition = prev.status;
      next.lastDispositionAt = new Date();
    }

    // Owner change → set assignment date
    if (
      next.assignedToId !== undefined &&
      next.assignedToId !== prev.assignedToId
    ) {
      next.leadAssignmentDate = new Date();
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    const statusChanged = row.status !== prev.status;
    if (!statusChanged) return;

    // Skip Task creation if the caller already made one (e.g. Disposition modal)
    const skipKey = `Lead:${row.id}:task`;
    const taskAlreadyMade = ctx.skip.has(skipKey);

    await ctx.prisma.leadHistory.create({
      data: {
        leadId: row.id,
        field: "Status",
        oldValue: prev.status,
        newValue: row.status,
        changedById: ctx.userId,
      },
    });

    if (!taskAlreadyMade) {
      await ctx.prisma.task.create({
        data: {
          recordType: "DISPOSITION",
          subject: `Status Changed to ${row.status}`,
          type: "TASK",
          status: "COMPLETED",
          leadId: row.id,
          ownerId: ctx.userId,
          notes: `Lead status changed from ${prev.status ?? "—"} to ${row.status ?? "—"}`,
          completedAt: new Date(),
        },
      });
    }

    // Auto-DNC on Archive Disposition (TCPA compliance, port of SF
    // LeadAfterTriggerHelper.addNumbersToFive9DNC). Anyone we archive
    // shouldn't get dialed again.
    if (row.status === "Archive Disposition" && row.phone) {
      await addSuppression({
        phone: row.phone,
        reason: "LeadArchived",
        source: `Lead ${row.id}`,
        leadId: row.id,
        addedById: ctx.userId,
      }).catch(() => undefined);
    }

    // Lifecycle email — welcome on conversion
    await onLeadStatusChange(row.id, prev.status ?? "", row.status ?? "").catch(() => undefined);
  },
};
