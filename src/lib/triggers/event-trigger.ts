/**
 * Port of SF EventTrigger / EventHandler.
 * Source: docs/sf-export/sfdx-raw/classes/EventHandler.cls
 *
 * Ported behaviors:
 *  - afterInsert: when an Event is created against a Lead or Opportunity,
 *    bump that record's lastContactedAt (matches
 *    EventHandler.populateLastContactedDateTime)
 *
 * Skipped:
 *  - "Lock Opportunity" validation (SF-specific)
 */

import type { Event } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { notify } from "@/lib/notifications/notify";
import { runRulesFor } from "@/lib/validation-rules/evaluator";

type EventWrite = Partial<Event> & Record<string, unknown>;

export const eventTrigger: Trigger<Event, EventWrite> = {
  async beforeInsert({ next }) {
    const vr = await runRulesFor("Event", next as Record<string, unknown>, "insert");
    if (!vr.ok) throw new Error(vr.message);
  },

  async beforeUpdate({ next, prev }) {
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Event", proposed, "update");
    if (!vr.ok) throw new Error(vr.message);
  },

  async afterInsert({ row, ctx }) {
    const now = new Date();
    if (row.leadId) {
      await ctx.prisma.lead.update({
        where: { id: row.leadId },
        data: { lastContactedAt: now },
      }).catch(() => undefined);
    }
    // Opportunity has no lastContactedAt today — skip until we add one.

    // Notify the event owner about new events they were assigned to.
    if (row.ownerId) {
      void notify({
        recipientId: row.ownerId,
        kind: "OWNER_ASSIGNED",
        title: `New event: ${row.subject}`,
        body: row.description ? String(row.description).slice(0, 200) : null,
        url: `/events/${row.id}`,
        entityType: "Event",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    // Owner reassignment → notify the new owner (skip self-assignment).
    if (row.ownerId && row.ownerId !== prev.ownerId) {
      void notify({
        recipientId: row.ownerId,
        kind: "OWNER_ASSIGNED",
        title: `Event "${row.subject}" was assigned to you`,
        url: `/events/${row.id}`,
        entityType: "Event",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }
  },
};
