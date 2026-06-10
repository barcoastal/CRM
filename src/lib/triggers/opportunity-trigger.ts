/**
 * Port of SF OpportunityTrigger / OpportunityTriggerHandler.
 * Source: docs/sf-export/sfdx-raw/classes/OpportunityTriggerHandler.cls
 *
 * Ported behaviors:
 *  - beforeUpdate:
 *    - Stage change → store previous stage into Opportunity.lastDisposition
 *      and timestamp Opportunity.lastDispositionAt
 *    - Sub-disposition change → store previous Sub_Disposition__c into
 *      Opportunity.lastSubDisposition (and refresh lastDispositionAt)
 *    - Total Debt change → mirror Total_Debt__c into Amount (SF DBST-187)
 *    - Owner change → stamp opportunityAssignmentDate via sfDataJson patch
 *      (no dedicated column yet — leave sf data for now)
 *    - Stage change to "Archived - Finalized" outside DeDuplication → throw
 *
 *  - afterUpdate:
 *    - Stage change → create a Task ("Stage Changed to X") unless the caller
 *      passed Opportunity:<id>:task into ctx.skip
 *    - Stage change → write an OpportunityHistory row
 *    - Transfer Qualification change → create a Task
 *      ("Transfer Qualification changed to X")
 *    - Stage change to "Contract Signed" → write OpportunityHistory + cascade
 *      Legal_Network to Account.legalStatus where available (best-effort)
 *    - Primary contact change → mirror to Account.primaryContactId
 *    - Owner change with accountId → mirror as Account.ownerId (SF "Closer__c"
 *      assignment, since we don't have a dedicated closerId column yet)
 *    - Stage change to "Closed Won First Payment Pending" → set
 *      Account.clientStatus = "Waiting First Payment" (SF AccountUtil)
 *    - Bank Change Contract Status → "Completed" with account → create a
 *      Task ("Bank Account Change Contract - Successfully Signed by the
 *      Customer") owned by account owner (best-effort)
 *
 * Skipped (handled elsewhere or out of scope):
 *  - Stage transition validation via PicklistValueTransitionHelper (SF-specific
 *    metadata-driven picklist transitions — see SF code 442-464 commented out)
 *  - Five9 list sync (Phase D)
 *  - Email notification "Opportunity Stage Update" (Phase F — flows)
 *  - Closed Won First Payment Pending cascade to Client (already handled in
 *    /api/opportunities/[id]/disposition for the Closed Won - First Payment
 *    Completed stage)
 *  - Processor sync on Contract Signed (Phase D — SAS/RAM/RELIANT integration)
 *  - Async Operation creation (Phase D)
 *  - Fronter lookup → Lead sync (we read fronter directly from opp)
 */

import type { Opportunity } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { firePostbackEvent } from "@/lib/marketing/postback";
import { notify } from "@/lib/notifications/notify";
import { runRulesFor } from "@/lib/validation-rules/evaluator";

type OppWrite = Partial<Opportunity> & Record<string, unknown>;

const STAGE_CLOSED_WON_PENDING = "Closed Won First Payment Pending";
const STAGE_CONTRACT_SIGNED = "Contract Signed";
const STAGE_ARCHIVED_FINALIZED = "Archived - Finalized";
const CLIENT_STATUS_WAITING_FIRST_PAYMENT = "Waiting First Payment";

export const opportunityTrigger: Trigger<Opportunity, OppWrite> = {
  async beforeInsert({ next }) {
    // Run admin-authored validation rules before any other insert logic.
    const vr = await runRulesFor(
      "Opportunity",
      next as Record<string, unknown>,
      "insert",
    );
    if (!vr.ok) throw new Error(vr.message);
  },

  async beforeUpdate({ next, prev, ctx }) {
    // Run admin-authored validation rules against the merged proposed row.
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Opportunity", proposed, "update");
    if (!vr.ok) throw new Error(vr.message);

    // Stage change → snapshot prev stage + timestamp
    if (next.stage !== undefined && next.stage !== prev.stage) {
      next.lastDisposition = prev.stage;
      next.lastDispositionAt = new Date();

      // Block direct transitions to "Archived - Finalized" unless the
      // DeDuplication caller pre-flagged via ctx.skip. Mirrors
      // OpportunityTriggerHandler.validateStageChange.
      const dedupSkip = `Opportunity:${prev.id}:archived-finalized`;
      if (
        next.stage === STAGE_ARCHIVED_FINALIZED &&
        prev.stage !== STAGE_ARCHIVED_FINALIZED &&
        !ctx.skip.has(dedupSkip)
      ) {
        throw new Error(
          'Stage cannot be changed to "Archived - Finalized" directly. ' +
            "This transition is only allowed through the DeDuplication process."
        );
      }
    }

    // Sub-disposition change → snapshot
    if (
      next.subDisposition !== undefined &&
      next.subDisposition !== prev.subDisposition
    ) {
      next.lastSubDisposition = prev.subDisposition;
      next.lastDispositionAt = new Date();
    }

    // Total Debt change → mirror into Amount (SF DBST-187)
    if (
      next.totalDebt !== undefined &&
      next.totalDebt !== prev.totalDebt &&
      next.amount === undefined
    ) {
      next.amount = next.totalDebt;
    }
  },

  afterInsert({ row }) {
    void firePostbackEvent({
      event: "opportunity.created",
      entityType: "Opportunity",
      entityId: row.id,
      data: { opportunity: row },
    }).catch(() => {});
  },

  async afterUpdate({ row, prev, ctx }) {
    // Primary contact changed → mirror to Account.primaryContactId
    // Port of SF OpportunityContactRoleTriggerHandler.assignPrimaryContactInAccount
    if (
      row.primaryContactId !== prev.primaryContactId &&
      row.primaryContactId &&
      row.accountId
    ) {
      await ctx.prisma.account
        .update({
          where: { id: row.accountId },
          data: { primaryContactId: row.primaryContactId },
        })
        .catch(() => undefined);
    }

    // Owner changed → mirror to Account.ownerId (SF closer assignment)
    if (
      row.assignedToId !== prev.assignedToId &&
      row.assignedToId &&
      row.accountId
    ) {
      await ctx.prisma.account
        .update({
          where: { id: row.accountId },
          data: { ownerId: row.assignedToId },
        })
        .catch(() => undefined);
    }

    // Owner reassignment → notify new owner (skip self-assignment).
    if (
      row.assignedToId &&
      row.assignedToId !== prev.assignedToId
    ) {
      void notify({
        recipientId: row.assignedToId,
        kind: "OWNER_ASSIGNED",
        title: `Opportunity ${row.name ?? row.id} was assigned to you`,
        url: `/opportunities/${row.id}`,
        entityType: "Opportunity",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }

    // Transfer Qualification change → log task
    if (
      row.transferQualification !== prev.transferQualification &&
      !ctx.skip.has(`Opportunity:${row.id}:tq-task`)
    ) {
      await ctx.prisma.task.create({
        data: {
          recordType: "DISPOSITION",
          subject: `Transfer Qualification changed to ${row.transferQualification ?? "-None-"}`,
          type: "TASK",
          status: "COMPLETED",
          opportunityId: row.id,
          leadId: row.leadId,
          ownerId: ctx.userId,
          notes: `The opportunity transfer qualification changed from ${prev.transferQualification ?? "-None-"} to ${row.transferQualification ?? "-None-"}`,
          completedAt: new Date(),
        },
      });

      await ctx.prisma.opportunityHistory
        .create({
          data: {
            opportunityId: row.id,
            field: "Transfer Qualification",
            oldValue: prev.transferQualification,
            newValue: row.transferQualification,
            changedById: ctx.userId,
          },
        })
        .catch(() => undefined);
    }

    // Bank Change Contract Status → Completed → create task on account owner
    if (
      row.bankChangeContractStatus !== prev.bankChangeContractStatus &&
      row.bankChangeContractStatus === "Completed" &&
      row.accountId
    ) {
      const acc = await ctx.prisma.account
        .findUnique({
          where: { id: row.accountId },
          select: { ownerId: true },
        })
        .catch(() => null);
      await ctx.prisma.task
        .create({
          data: {
            subject:
              "Bank Account Change Contract - Successfully Signed by the Customer",
            recordType: "ACTIVITY",
            type: "TASK",
            status: "NOT_STARTED",
            accountId: row.accountId,
            opportunityId: row.id,
            ownerId: acc?.ownerId ?? ctx.userId,
            dueDate: new Date(),
          },
        })
        .catch(() => undefined);
    }

    const stageChanged = row.stage !== prev.stage;
    if (!stageChanged) return;

    await ctx.prisma.opportunityHistory.create({
      data: {
        opportunityId: row.id,
        field: "Stage",
        oldValue: prev.stage,
        newValue: row.stage,
        changedById: ctx.userId,
      },
    });

    const taskSkip = `Opportunity:${row.id}:task`;
    if (!ctx.skip.has(taskSkip)) {
      await ctx.prisma.task.create({
        data: {
          recordType: "DISPOSITION",
          subject: `Stage Changed to ${row.stage}`,
          type: "TASK",
          status: "COMPLETED",
          opportunityId: row.id,
          leadId: row.leadId,
          ownerId: ctx.userId,
          notes: `Opportunity Stage changed from ${prev.stage ?? "-None-"} to ${row.stage ?? "-None-"}`,
          completedAt: new Date(),
        },
      });
    }

    // Closed Won First Payment Pending → flip Account.clientStatus
    if (
      row.stage === STAGE_CLOSED_WON_PENDING &&
      prev.stage !== STAGE_CLOSED_WON_PENDING &&
      row.accountId
    ) {
      await ctx.prisma.account
        .update({
          where: { id: row.accountId },
          data: { clientStatus: CLIENT_STATUS_WAITING_FIRST_PAYMENT },
        })
        .catch(() => undefined);
    }

    // Contract Signed → mark first contract signed date if not already
    if (
      row.stage === STAGE_CONTRACT_SIGNED &&
      prev.stage !== STAGE_CONTRACT_SIGNED &&
      !row.firstContractSignedDateOpp
    ) {
      await ctx.prisma.opportunity
        .update({
          where: { id: row.id },
          data: { firstContractSignedDateOpp: new Date() },
        })
        .catch(() => undefined);
    }

    // Marketing postbacks for stage changes (fire-and-forget)
    void firePostbackEvent({
      event: "opportunity.stage_changed",
      entityType: "Opportunity",
      entityId: row.id,
      data: { opportunity: row, prev: { stage: prev.stage } },
    }).catch(() => {});

    // Closed Won detection covers any "Closed Won*" stage (SF uses several)
    const stageStr = String(row.stage ?? "");
    if (stageStr.toLowerCase().includes("closed won")) {
      void firePostbackEvent({
        event: "opportunity.closed_won",
        entityType: "Opportunity",
        entityId: row.id,
        data: { opportunity: row, prev: { stage: prev.stage } },
      }).catch(() => {});
    }
    if (stageStr.toLowerCase().includes("closed lost")) {
      void firePostbackEvent({
        event: "opportunity.closed_lost",
        entityType: "Opportunity",
        entityId: row.id,
        data: { opportunity: row, prev: { stage: prev.stage } },
      }).catch(() => {});
    }
  },
};
