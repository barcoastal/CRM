/**
 * Port of SF contactTrigger / ContactHandler.
 * Source: docs/sf-export/sfdx-raw/classes/ContactHandler.cls
 *
 * Ported behaviors:
 *  - beforeInsert / beforeUpdate:
 *    - Derive fullName from firstName + lastName
 *
 *  - afterUpdate:
 *    - If any contact field that the payment processor cares about changed,
 *      flip the parent Account's bankAccountSyncStatus / processorStatus to
 *      "Sync Pending" (matches ContactHandler.populateSyncPending)
 *
 * Skipped:
 *  - SSN encrypted ↔ SSN text mirroring (we use ssnLast4 only)
 */

import type { Contact } from "@/generated/prisma/client";
import type { Trigger } from "./types";

type ContactWrite = Partial<Contact> & Record<string, unknown>;

const SYNC_RELEVANT_FIELDS: (keyof Contact)[] = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "mobilePhone",
  "birthdate",
];

export const contactTrigger: Trigger<Contact, ContactWrite> = {
  beforeInsert({ next }) {
    const first = typeof next.firstName === "string" ? next.firstName.trim() : "";
    const last = typeof next.lastName === "string" ? next.lastName.trim() : "";
    next.fullName = `${first} ${last}`.trim();
  },
  beforeUpdate({ next, prev }) {
    if (next.firstName !== undefined || next.lastName !== undefined) {
      const first = typeof next.firstName === "string" ? next.firstName.trim() : prev.firstName?.trim() ?? "";
      const last = typeof next.lastName === "string" ? next.lastName.trim() : prev.lastName?.trim() ?? "";
      next.fullName = `${first} ${last}`.trim();
    }
  },
  async afterUpdate({ row, prev, ctx }) {
    if (!row.primaryAccountId) return;
    const relevantChanged = SYNC_RELEVANT_FIELDS.some(
      (f) => prev[f] !== row[f]
    );
    if (!relevantChanged) return;
    await ctx.prisma.account.update({
      where: { id: row.primaryAccountId },
      data: { bankAccountSyncStatus: "Sync Pending", processorStatus: "Sync Pending" },
    }).catch(() => undefined);
  },
};
