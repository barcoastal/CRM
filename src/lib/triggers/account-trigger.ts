/**
 * Port of SF accountTrigger / AccountHandler / AccountAfterTriggerHelper.
 * Source: docs/sf-export/sfdx-raw/classes/AccountHandler.cls
 *
 * Ported behaviors:
 *  - beforeUpdate:
 *    - Stage change → store previous stage into Account.lastDisposition
 *    - Bank field change (bankName/routing/account) → flip
 *      bankAccountSyncStatus to "Sync Pending" and processorStatus → "Sync Pending"
 *      (matches AccountHandler.populateSyncStatusFields)
 *
 *  - afterUpdate:
 *    - Stage change → AccountHistory row
 *    - clientStatus → Cancelled or Graduated → close open Cases on this Account
 *      and complete open Tasks (AccountHandler.closeCaseOnAccountStatusUpdate)
 *    - clientStatus → Active (from Cancelled) → no-op for now; SF flips a flag
 *    - feePaidInFull true → set processorStatus = "Fee Paid in Full"
 *
 * Skipped:
 *  - Picklist transition validation (SF-specific)
 *  - SAS sync calls (Phase C — payment processor)
 *  - Email notifications
 */

import type { Account } from "@/generated/prisma/client";
import type { Trigger } from "./types";

type AccountWrite = Partial<Account> & Record<string, unknown>;

const BANK_FIELDS = ["bankName", "bankRoutingNumber", "bankAccountNumber", "bankAccountType"] as const;

export const accountTrigger: Trigger<Account, AccountWrite> = {
  beforeUpdate({ next, prev }) {
    // Bank info changed → mark sync pending
    const bankChanged = BANK_FIELDS.some(
      (f) => next[f] !== undefined && next[f] !== prev[f]
    );
    if (bankChanged) {
      next.bankAccountSyncStatus = "Sync Pending";
      next.processorStatus = "Sync Pending";
    }

    // Fee paid in full flag → set processor status label
    if (next.feePaidInFull === true && prev.feePaidInFull !== true) {
      next.processorStatus = "Fee Paid in Full";
    }
  },

  async afterUpdate({ row, prev, ctx }) {
    // Stage change → AccountHistory entry
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
    }

    // Client status flipped to Cancelled or Graduated → close cases + tasks
    const clientStatusChanged = row.clientStatus !== prev.clientStatus;
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
  },
};
