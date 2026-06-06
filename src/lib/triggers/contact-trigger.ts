/**
 * Port of SF contactTrigger / ContactHandler.
 * Source: docs/sf-export/sfdx-raw/classes/ContactHandler.cls
 *
 * Ported behaviors:
 *  - beforeInsert / beforeUpdate:
 *    - Derive fullName from firstName + lastName (handles trailing spaces and
 *      single-name contacts gracefully)
 *    - If only fullName is supplied without firstName/lastName, split it.
 *
 *  - afterInsert:
 *    - If the contact is created with a primaryAccountId and there is no
 *      AccountContactRelation, create one with role "Owner".
 *    - If the account has no primaryContactId yet, set it to this contact
 *      (mirrors SF primaryContact auto-assignment for new accounts).
 *
 *  - afterUpdate:
 *    - If any contact field that the payment processor cares about changed,
 *      flip the parent Account's bankAccountSyncStatus / processorStatus to
 *      "Sync Pending" (matches ContactHandler.populateSyncPending).
 *    - If primaryAccountId changes, keep AccountContactRelation in sync:
 *      add a relation for the new account if missing.
 *    - Email / phone change → log to account history if linked.
 *
 * Skipped:
 *  - SSN encrypted ↔ SSN text mirroring (we use Account.ssnLast4 only;
 *    Contact has no SSN field in current Prisma schema).
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
  "title",
];

function deriveFullName(first: string, last: string): string {
  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

export const contactTrigger: Trigger<Contact, ContactWrite> = {
  beforeInsert({ next }) {
    const first = typeof next.firstName === "string" ? next.firstName.trim() : "";
    let last = typeof next.lastName === "string" ? next.lastName.trim() : "";
    // If only fullName was given and lastName is empty, split on the last space
    if (!last && typeof next.fullName === "string" && next.fullName.trim()) {
      const parts = next.fullName.trim().split(/\s+/);
      if (parts.length === 1) {
        last = parts[0];
        if (!first) next.firstName = "";
        next.lastName = last;
      } else {
        const split = parts.pop()!;
        last = split;
        if (!first) next.firstName = parts.join(" ");
        next.lastName = split;
      }
    }
    next.fullName = deriveFullName(first || (next.firstName as string) || "", last || (next.lastName as string) || "");
  },

  beforeUpdate({ next, prev }) {
    if (next.firstName !== undefined || next.lastName !== undefined) {
      const first = typeof next.firstName === "string" ? next.firstName.trim() : prev.firstName?.trim() ?? "";
      const last = typeof next.lastName === "string" ? next.lastName.trim() : prev.lastName?.trim() ?? "";
      next.fullName = deriveFullName(first, last);
    }
  },

  async afterInsert({ row, ctx }) {
    if (!row.primaryAccountId) return;
    // Ensure an AccountContactRelation exists
    await ctx.prisma.accountContactRelation
      .upsert({
        where: { accountId_contactId: { accountId: row.primaryAccountId, contactId: row.id } },
        create: { accountId: row.primaryAccountId, contactId: row.id, role: "Owner", isDirect: true },
        update: {},
      })
      .catch(() => undefined);

    // If the account has no primary contact, claim it
    const account = await ctx.prisma.account.findUnique({
      where: { id: row.primaryAccountId },
      select: { primaryContactId: true },
    });
    if (account && !account.primaryContactId) {
      await ctx.prisma.account
        .update({
          where: { id: row.primaryAccountId },
          data: { primaryContactId: row.id },
        })
        .catch(() => undefined);
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    // Account moved → ensure relation exists on new account
    if (row.primaryAccountId && row.primaryAccountId !== prev.primaryAccountId) {
      await ctx.prisma.accountContactRelation
        .upsert({
          where: { accountId_contactId: { accountId: row.primaryAccountId, contactId: row.id } },
          create: { accountId: row.primaryAccountId, contactId: row.id, role: "Owner", isDirect: true },
          update: {},
        })
        .catch(() => undefined);
    }

    if (!row.primaryAccountId) return;
    const relevantChanged = SYNC_RELEVANT_FIELDS.some((f) => prev[f] !== row[f]);
    if (!relevantChanged) return;

    await ctx.prisma.account
      .update({
        where: { id: row.primaryAccountId },
        data: { bankAccountSyncStatus: "Sync Pending", processorStatus: "Sync Pending" },
      })
      .catch(() => undefined);

    // Surface email / phone change to account history so closers see it
    if (row.email !== prev.email) {
      await ctx.prisma.accountHistory
        .create({
          data: {
            accountId: row.primaryAccountId,
            field: "Contact Email",
            oldValue: prev.email,
            newValue: row.email,
            changedById: ctx.userId,
          },
        })
        .catch(() => undefined);
    }
    if (row.phone !== prev.phone) {
      await ctx.prisma.accountHistory
        .create({
          data: {
            accountId: row.primaryAccountId,
            field: "Contact Phone",
            oldValue: prev.phone,
            newValue: row.phone,
            changedById: ctx.userId,
          },
        })
        .catch(() => undefined);
    }
  },
};
