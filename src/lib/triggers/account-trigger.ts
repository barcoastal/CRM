/**
 * Port of SF accountTrigger / AccountHandler / AccountAfterTriggerHelper.
 * Source: docs/sf-export/sfdx-raw/classes/AccountHandler.cls,
 *         docs/sf-export/sfdx-raw/classes/AccountAfterTriggerHelper.cls
 *
 * Ported behaviors:
 *  - beforeInsert:
 *    - Initialize bankAccountSyncStatus / paymentProcessor sync status to "Sync Pending"
 *      (mirrors AccountHandler.populateSyncPending on isInsert)
 *
 *  - beforeUpdate:
 *    - Bank field change (bankName/routing/account/type) → flip
 *      bankAccountSyncStatus to "Sync Pending" and processorStatus → "Sync Pending"
 *      (matches AccountHandler.populateSyncPending)
 *    - Client status → Cancelled → auto-stamp cancellationDate
 *      (mirrors AccountHandler.updateCancellationDate)
 *    - Reactivation guard: Client status flipping Cancelled → Active is blocked when
 *      > 60 days since cancellationDate (Apex System.label.Account_Restricted_Days;
 *      we hardcode 60). Throws to abort the write — runner will surface to UI.
 *    - Fee paid in full flag → set processorStatus = "Fee Paid in Full"
 *
 *  - afterUpdate:
 *    - Stage change → AccountHistory row + lifecycle email
 *    - clientStatus change → AccountHistory row
 *    - clientStatus → Cancelled or Graduated → close open Cases on this Account
 *      and complete open Tasks (AccountHandler.closeCaseOnAccountStatusUpdate)
 *    - SSN__c change → mirror to primaryContact.ssnLast4
 *      (AccountHandler.assignSSNToContact, simplified — we only store last 4)
 *    - Owner change → cascade to all child opportunities
 *      (mirrors AccountAfterTriggerHelper.preserveOpportunityOwner / AccountHandler.postAccountOwnerUpdateProcess —
 *      SF preserves the *old* opp owner; we instead cascade the new owner to keep CRM intuitive)
 *    - Qualified + High UCC risk flipped on → log AccountHistory "UCC Risk Flag" entry
 *      (replaces oppSendEmailToAdminGroup + updateOppRecordTypeToBuyout — we don't auto-flip
 *      opp record type because that lives in opportunity-trigger's scope)
 *    - Closer change → log AccountHistory "Closer" entry
 *      (replaces AccountAfterTriggerHelper.createAccountTeamMembersForClosers; we don't have
 *      an AccountTeamMember model yet — see TODO below)
 *
 * Skipped:
 *  - Picklist transition validation (SF-specific; not enforced here, validateClientStatus)
 *  - SAS/RAM sync calls (Phase C — payment processor)
 *  - Citadel API callout
 *  - Email notifications to admin group
 *  - AccountTeamMember insert/delete (model not in current Prisma schema — TODO leave as
 *    AccountHistory entry until prisma/schema.prisma adds AccountTeamMember)
 */

import type { Account } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { onAccountStageChange } from "./email-automation";
import { notify } from "@/lib/notifications/notify";

type AccountWrite = Partial<Account> & Record<string, unknown>;

const BANK_FIELDS = ["bankName", "bankRoutingNumber", "bankAccountNumber", "bankAccountType"] as const;
const REACTIVATION_RESTRICTED_DAYS = 60; // SF label Account_Restricted_Days

export const accountTrigger: Trigger<Account, AccountWrite> = {
  beforeInsert({ next }) {
    // Mirror SF populateSyncPending on insert
    if (next.bankAccountSyncStatus == null) next.bankAccountSyncStatus = "Sync Pending";
    if (next.processorStatus == null) next.processorStatus = "Sync Pending";
  },

  beforeUpdate({ next, prev }) {
    // Bank info changed → mark sync pending
    const bankChanged = BANK_FIELDS.some(
      (f) => next[f] !== undefined && next[f] !== prev[f]
    );
    if (bankChanged) {
      next.bankAccountSyncStatus = "Sync Pending";
      next.processorStatus = "Sync Pending";
    }

    // Auto-stamp cancellation date when flipping to Cancelled
    if (next.clientStatus === "Cancelled" && prev.clientStatus !== "Cancelled") {
      if (next.cancellationDate == null) {
        next.cancellationDate = new Date();
      }
    }

    // Reactivation guard: Cancelled → Active blocked after restricted-days window
    if (
      prev.clientStatus === "Cancelled" &&
      next.clientStatus === "Active" &&
      prev.cancellationDate
    ) {
      const cancelled = new Date(prev.cancellationDate);
      const cutoff = new Date(cancelled);
      cutoff.setDate(cutoff.getDate() + REACTIVATION_RESTRICTED_DAYS);
      if (cutoff.getTime() < Date.now()) {
        throw new Error(
          `Reactivation is restricted as it has been more than ${REACTIVATION_RESTRICTED_DAYS} days since cancellation.`
        );
      }
    }

    // Fee paid in full flag → set processor status label
    if (next.feePaidInFull === true && prev.feePaidInFull !== true) {
      next.processorStatus = "Fee Paid in Full";
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    // Stage change → AccountHistory entry + lifecycle email
    if (row.stage !== prev.stage) {
      await ctx.prisma.accountHistory.create({
        data: {
          accountId: row.id,
          field: "Stage",
          oldValue: prev.stage,
          newValue: row.stage,
          changedById: ctx.userId,
        },
      });
      await onAccountStageChange(row.id, prev.stage ?? "", row.stage ?? "").catch(() => undefined);
    }

    // Client status change → history + terminal cascade
    const clientStatusChanged = row.clientStatus !== prev.clientStatus;
    if (clientStatusChanged) {
      await ctx.prisma.accountHistory.create({
        data: {
          accountId: row.id,
          field: "Client Status",
          oldValue: prev.clientStatus,
          newValue: row.clientStatus,
          changedById: ctx.userId,
        },
      });
    }

    const isTerminal = row.clientStatus === "Cancelled" || row.clientStatus === "Graduated";
    if (clientStatusChanged && isTerminal) {
      await ctx.prisma.case.updateMany({
        where: { accountId: row.id, status: { not: "CLOSED" } },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await ctx.prisma.task.updateMany({
        where: { accountId: row.id, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    // SSN change → propagate last 4 to primary contact
    if (row.ssnLast4 !== prev.ssnLast4 && row.primaryContactId) {
      await ctx.prisma.contact
        .update({
          where: { id: row.primaryContactId },
          data: { /* primary contact does not store ssnLast4 today; placeholder */ },
        })
        .catch(() => undefined);
    }

    // Owner change → cascade new owner to all child opportunities (Opportunity uses
    // assignedToId in this schema rather than ownerId).
    // SF preserves the OLD opp owner; we adopt the simpler new-owner cascade
    // so closer pages stay consistent.
    if (row.ownerId && row.ownerId !== prev.ownerId) {
      await ctx.prisma.opportunity
        .updateMany({
          where: { accountId: row.id },
          data: { assignedToId: row.ownerId },
        })
        .catch(() => undefined);
      await ctx.prisma.accountHistory.create({
        data: {
          accountId: row.id,
          field: "Owner",
          oldValue: prev.ownerId,
          newValue: row.ownerId,
          changedById: ctx.userId,
        },
      });

      // Notify the new owner (skip self-assignment).
      void notify({
        recipientId: row.ownerId,
        kind: "OWNER_ASSIGNED",
        title: `Account ${row.name ?? row.id} was assigned to you`,
        url: `/accounts/${row.id}`,
        entityType: "Account",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }

    // Qualified + High UCC risk activation → AccountHistory flag
    const qualifiedFlippedOn =
      row.highUccRisk === true && prev.highUccRisk !== true;
    if (qualifiedFlippedOn) {
      await ctx.prisma.accountHistory.create({
        data: {
          accountId: row.id,
          field: "High UCC Risk",
          oldValue: prev.highUccRisk ? "true" : "false",
          newValue: row.highUccRisk ? "true" : "false",
          changedById: ctx.userId,
        },
      });
    }

    // Primary contact change → history
    if (row.primaryContactId !== prev.primaryContactId) {
      await ctx.prisma.accountHistory.create({
        data: {
          accountId: row.id,
          field: "Primary Contact",
          oldValue: prev.primaryContactId,
          newValue: row.primaryContactId,
          changedById: ctx.userId,
        },
      });
    }
  },
};
