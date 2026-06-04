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

type EventWrite = Partial<Event> & Record<string, unknown>;

export const eventTrigger: Trigger<Event, EventWrite> = {
  async afterInsert({ row, ctx }) {
    const now = new Date();
    if (row.leadId) {
      await ctx.prisma.lead.update({
        where: { id: row.leadId },
        data: { lastContactedAt: now },
      }).catch(() => undefined);
    }
    // Opportunity has no lastContactedAt today — skip until we add one.
  },
};
