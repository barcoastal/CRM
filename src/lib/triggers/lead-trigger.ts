/**
 * Port of SF LeadTrigger / LeadTriggerHandler / LeadAfterTriggerHelper.
 * Source: docs/sf-export/sfdx-raw/classes/LeadTriggerHandler.cls
 *          docs/sf-export/sfdx-raw/classes/LeadAfterTriggerHelper.cls
 *
 * Ported behaviors (in SF parity order):
 *
 * beforeInsert:
 *  - validateCreditorPayments: stamp Is_Payment_Amount_Populated__c in sfDataJson
 *  - populateArchivedDateAndIsArchivedCheckbox: when initial status is Archive
 *    Disposition, set Is_Archived__c=true and Archived_Date__c=today in sfDataJson
 *
 * beforeUpdate:
 *  - Status change -> store previous status into Lead.lastDisposition + timestamp
 *  - SubDisposition change (via sfDataJson Sub_Disposition__c) -> roll previous
 *    value to Last_Sub_Disposition__c in sfDataJson and stamp lastSubDisposition
 *  - Owner change -> set leadAssignmentDate=today
 *  - validateCreditorPayments rerun
 *  - populateArchivedDateAndIsArchivedCheckbox: status -> Archive Disposition
 *    sets Is_Archived__c=true + Archived_Date__c=today in sfDataJson
 *  - archiveLeadsBasedOnDisposition: Five9 disposition flips to FAKE / DIDNT
 *    REGISTER -> force status = Archive Disposition + Sub_Disposition__c = Fake
 *
 * afterUpdate:
 *  - Status change -> create LeadHistory entry + Disposition Task (unless
 *    caller already created one via skip key)
 *  - subDispoRequiredForArchivedLeads: status=Archive without sub-disposition
 *    -> create app-log entry (we surface but don't throw to avoid blocking
 *    legacy callers that don't pass sfDataJson)
 *  - Auto-DNC suppression when status moves to Archive Disposition
 *  - Lifecycle email automation on transition
 *  - populateFronterDetailsInOpp: if Fronter / Call_Transferred_By changed
 *    after conversion, sync the Opportunity (best-effort via raw update)
 *
 * Skipped (need other infra, document as TODO):
 *  - Five9 list sync (Phase D)
 *  - Individual record creation (separate identity system)
 *  - No-business-state validation (needs state code list / metadata)
 *  - shareLeadToMCA (MCA lender callout)
 *  - deduplicateWebLeadsAndUpdateFive9DNC (web-leads ingest path)
 */

import type { Lead } from "@/generated/prisma/client";
import type { Trigger } from "./types";
import { addSuppression } from "@/lib/dnc";
import { onLeadStatusChange } from "./email-automation";
import { firePostbackEvent } from "@/lib/marketing/postback";
import { notify } from "@/lib/notifications/notify";
import { runRulesFor } from "@/lib/validation-rules/evaluator";

// Use a permissive shape so trigger writers can set FK columns directly.
type LeadWrite = Partial<Lead> & Record<string, unknown>;

export const LEAD_TRIGGER_SKIP_TASK = Symbol.for("lead-trigger-skip-task");

// Five9 dispositions that mean "this lead isn't real, archive it"
const FIVE9_FAKE_DISPOSITIONS = new Set(["FAKE", "Fake Lead", "Fake Leads"]);
const FIVE9_DIDNT_REGISTER_DISPOSITIONS = new Set([
  "DIDNT Register",
  "Lead Did Not Register",
]);

const ARCHIVE_STATUS = "Archive Disposition";
const SUB_DISPO_FAKE = "Fake Lead";

function parseSfData(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringifySfData(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

/**
 * SF parity: validateCreditorPayments() — returns false if any creditor has a
 * Total_Debt populated but Payment <= 0. We stamp this back into sfDataJson so
 * downstream reports + the "Is Payment Amount Populated" formula field still
 * resolve.
 */
function validateCreditorPayments(sf: Record<string, unknown>): boolean {
  for (let i = 1; i <= 10; i++) {
    const totalDebt = Number(sf[`Creditor_${i}_Total_Debt__c`]);
    const payment = Number(sf[`Creditor_${i}_Payment__c`]);
    if (Number.isFinite(totalDebt) && totalDebt > 0 && Number.isFinite(payment) && payment <= 0) {
      return false;
    }
  }
  return true;
}

/**
 * SF parity: calculateCurrentTotalWeeklyPayment() — sum each creditor's
 * payment normalized to a weekly amount. Daily *5, Monthly /4, Weekly as-is.
 */
function recalcCreditorWeeklyTotal(sf: Record<string, unknown>): number {
  let total = 0;
  for (let i = 1; i <= 10; i++) {
    const raw = sf[`Creditor_${i}_Payment__c`];
    if (raw == null || raw === "") continue;
    const pay = Number(raw);
    if (!Number.isFinite(pay)) continue;
    const freq = String(sf[`Creditor_${i}_Payment_Frequency__c`] ?? "");
    let weekly = pay;
    if (freq === "Daily") weekly = pay * 5;
    else if (freq === "Monthly") weekly = pay / 4;
    total += weekly;
  }
  return total;
}

export const leadTrigger: Trigger<Lead, LeadWrite> = {
  async beforeInsert({ next }) {
    // Run admin-authored validation rules first so a failed rule blocks the
    // write before any side-effecting state mutation below runs.
    const vr = await runRulesFor("Lead", next as Record<string, unknown>, "insert");
    if (!vr.ok) throw new Error(vr.message);

    // Carry over any sf snapshot the caller passed; we may write into it.
    const sf = parseSfData((next.sfDataJson as string | null | undefined) ?? null);

    sf.Is_Payment_Amount_Populated__c = validateCreditorPayments(sf);

    // Initial creditor totals -> currentTotalWeeklyPayment + sfDataJson mirror
    const weekly = recalcCreditorWeeklyTotal(sf);
    if (weekly > 0) {
      next.currentTotalWeeklyPayment = weekly;
      sf.Current_Total_Weekly_Payment__c = weekly;
    }

    // If the lead is being created already in Archive Disposition status, stamp
    // archived metadata up-front (SF populateArchivedDateAndIsArchivedCheckbox).
    if (next.status === ARCHIVE_STATUS) {
      sf.Is_Archived__c = true;
      sf.Archived_Date__c = new Date().toISOString().slice(0, 10);
    }

    next.sfDataJson = stringifySfData(sf);
  },

  async beforeUpdate({ next, prev }) {
    // Run admin-authored validation rules against the merged proposed row so
    // a failed rule throws before any state mutation below.
    const proposed = { ...(prev as Record<string, unknown>), ...(next as Record<string, unknown>) };
    const vr = await runRulesFor("Lead", proposed, "update");
    if (!vr.ok) throw new Error(vr.message);

    // Status change -> roll previous status into lastDisposition
    if (next.status !== undefined && next.status !== prev.status) {
      next.lastDisposition = prev.status;
      next.lastDispositionAt = new Date();
    }

    // Owner change -> set assignment date
    if (
      next.assignedToId !== undefined &&
      next.assignedToId !== prev.assignedToId
    ) {
      next.leadAssignmentDate = new Date();
    }

    // Merge sfDataJson before / after so we can compute sub-dispo + creditor
    // rollups. Callers may either pass a complete new JSON or omit it; we
    // start from prev and apply next on top so behavior is the same.
    const prevSf = parseSfData(prev.sfDataJson);
    const incomingSf = parseSfData((next.sfDataJson as string | null | undefined) ?? null);
    const sf: Record<string, unknown> = { ...prevSf, ...incomingSf };

    // Sub-disposition rolling (SF: Last_Sub_Disposition__c + Last_Disposition_DateTime__c)
    const prevSub = prevSf.Sub_Disposition__c;
    const newSub = sf.Sub_Disposition__c;
    if (newSub !== undefined && newSub !== prevSub) {
      sf.Last_Sub_Disposition__c = prevSub ?? null;
      sf.Last_Disposition_DateTime__c = new Date().toISOString();
      // Mirror to canonical column so list views can sort/filter without JSON
      next.lastSubDisposition = (prevSub ?? null) as string | null;
    }

    // Five9 disposition flip -> Archive (SF archiveLeadsBasedOnDisposition)
    const prevFive9 = prevSf.five9_Disposition__c as string | undefined;
    const newFive9 = sf.five9_Disposition__c as string | undefined;
    if (newFive9 && newFive9 !== prevFive9) {
      if (
        FIVE9_FAKE_DISPOSITIONS.has(newFive9) ||
        FIVE9_DIDNT_REGISTER_DISPOSITIONS.has(newFive9)
      ) {
        next.status = ARCHIVE_STATUS;
        sf.Is_Archived__c = true;
        sf.Sub_Disposition__c = SUB_DISPO_FAKE;
        if (next.lastDisposition === undefined) {
          next.lastDisposition = prev.status;
          next.lastDispositionAt = new Date();
        }
      }
    }

    // populateArchivedDateAndIsArchivedCheckbox: any status flip into Archive
    if (next.status === ARCHIVE_STATUS && prev.status !== ARCHIVE_STATUS) {
      sf.Is_Archived__c = true;
      sf.Archived_Date__c = new Date().toISOString().slice(0, 10);
      // Preserve the previous Five9 list id so async cleanup can dequeue it
      if (sf.Five9_List_Id__c) {
        sf.Delete_from_f9list_id__c = sf.Five9_List_Id__c;
        sf.Five9_List_Id__c = "";
      }
    }

    // Recompute Is_Payment_Amount_Populated__c + currentTotalWeeklyPayment
    sf.Is_Payment_Amount_Populated__c = validateCreditorPayments(sf);
    const weekly = recalcCreditorWeeklyTotal(sf);
    if (weekly > 0) {
      next.currentTotalWeeklyPayment = weekly;
      sf.Current_Total_Weekly_Payment__c = weekly;
    }

    next.sfDataJson = stringifySfData(sf);
  },

  afterInsert({ row }) {
    // Fire-and-forget marketing postback. Note: inbound-driven Lead creation
    // also fires this directly from src/lib/marketing/inbound.ts; the trigger
    // path covers all OTHER creation sources (manual, ingest, importer).
    void firePostbackEvent({
      event: "lead.created",
      entityType: "Lead",
      entityId: row.id,
      data: { lead: row },
    }).catch(() => {});
  },

  async afterUpdate({ row, prev, ctx }) {
    // Owner reassignment → notify the new owner (skip self-assignment).
    if (
      row.assignedToId &&
      row.assignedToId !== prev.assignedToId
    ) {
      void notify({
        recipientId: row.assignedToId,
        kind: "OWNER_ASSIGNED",
        title: `Lead ${row.contactName ?? row.businessName ?? row.id} was assigned to you`,
        url: `/leads/${row.id}`,
        entityType: "Lead",
        entityId: row.id,
        actorId: ctx.userId,
        skipIfSelf: true,
      });
    }

    const statusChanged = row.status !== prev.status;

    // subDispoRequiredForArchivedLeads: log (don't throw) when archived without
    // a sub-disposition. SF throws a custom exception; we log so we don't break
    // legacy upstream pipelines that haven't been updated yet.
    if (statusChanged && row.status === ARCHIVE_STATUS) {
      const sf = parseSfData(row.sfDataJson);
      const sub = sf.Sub_Disposition__c;
      if (!sub) {
        // Best-effort warning trail; non-fatal.
        await ctx.prisma.leadHistory
          .create({
            data: {
              leadId: row.id,
              field: "Sub_Disposition_Validation",
              oldValue: null,
              newValue: "Sub Disposition is Required When lead is Archived",
              changedById: ctx.userId,
            },
          })
          .catch(() => undefined);
      }
    }

    if (!statusChanged) {
      // populateFronterDetailsInOpp still runs on lookup field changes even
      // when status didn't change. Best-effort opp sync.
      await syncFronterToOpp(row, prev, ctx).catch(() => undefined);
      return;
    }

    // Marketing postback: lead.disposition_changed
    void firePostbackEvent({
      event: "lead.disposition_changed",
      entityType: "Lead",
      entityId: row.id,
      data: {
        lead: row,
        prev: { status: prev.status, lastDisposition: prev.lastDisposition },
      },
    }).catch(() => {});

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
          notes: `Lead Status changed from ${prev.status ?? "-None-"} to ${row.status ?? "-None-"}`,
          completedAt: new Date(),
        },
      });
    }

    // Auto-DNC on Archive Disposition (TCPA compliance, port of SF
    // LeadAfterTriggerHelper.addNumbersToFive9DNC). Anyone we archive
    // shouldn't get dialed again.
    if (row.status === ARCHIVE_STATUS && row.phone) {
      await addSuppression({
        phone: row.phone,
        reason: "LeadArchived",
        source: `Lead ${row.id}`,
        leadId: row.id,
        addedById: ctx.userId,
      }).catch(() => undefined);
    }

    // Lifecycle email - welcome on conversion
    await onLeadStatusChange(row.id, prev.status ?? "", row.status ?? "").catch(() => undefined);

    // Sync fronter details to the converted opp
    await syncFronterToOpp(row, prev, ctx).catch(() => undefined);
  },
};

/**
 * SF parity: LeadAfterTriggerHelper.populateFronterDetailsInOpp
 * When the lead has been converted and the fronter / call transfer fields
 * change, push them into the related Opportunity.
 *
 * We only touch the Opportunity directly because the Opp trigger module
 * doesn't currently care about these passthrough fields.
 */
async function syncFronterToOpp(row: Lead, prev: Lead, ctx: { prisma: import("@/generated/prisma/client").PrismaClient | Omit<import("@/generated/prisma/client").PrismaClient, "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends"> }): Promise<void> {
  if (!row.convertedOpportunityId) return;
  const prevSf = parseSfData(prev.sfDataJson);
  const nextSf = parseSfData(row.sfDataJson);
  const keys = ["FronterLookup__c", "Call_Transferred_By_Lookup__c", "Call_Tranferred_DateTime__c"];
  const anyChanged = keys.some((k) => prevSf[k] !== nextSf[k]);
  if (!anyChanged) return;

  // We don't own the Opportunity schema; mirror through opp.fronter on the
  // canonical column when we can, and leave the rest in sfDataJson on the
  // opp side. This is intentionally best-effort.
  await ctx.prisma.opportunity
    .update({
      where: { id: row.convertedOpportunityId },
      data: {
        fronter: (nextSf.FronterLookup__c ?? null) as string | null,
      },
    })
    .catch(() => undefined);
}
