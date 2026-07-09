/**
 * SAS outbound draft sync - pushes CRM draft changes to SAS (sasdashboard.com).
 *
 * Port of SF ProcessorCreateAPI.createDraftAPIBulk + SASApi.syncDrafts. The
 * routing rules mirror Salesforce exactly:
 *
 *   plan has no externalDebitScheduleId + draft pending  -> SetDebitSchedule
 *   plan has schedule, draft has no externalSasId        -> AddDebits
 *   draft has externalSasId + CANCELLED/SKIPPED          -> CancelDebits
 *   draft has externalSasId otherwise                    -> UpdateDebits
 *
 * Payload (per SASWrapper.DebitSchedule):
 *   { CustomerID, RemoteID, DebitScheduleID, Debits: [
 *       { DebitRemoteID, DebitID, Amount, Date, Payouts: [{PayeeID, Amount, PayoutDate}] } ] }
 *
 * TEST MODE (default): builds the exact payloads and journals them to
 * ProcessorSyncLog with status DRY_RUN - nothing leaves the building. Flip
 * SAS_OUTBOUND_MODE=live (env) to actually send. Every live call is journaled
 * too, with the SAS response.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Fee payee ids from the SF "SAS Processor" record (Payment_Processor__c
// a0W8Y00000Sbq8WUAR). Setup and Citadel share payee 15 - SF disambiguates by
// comparing the amount to the plan's setup fee; we keep them as separate
// payout lines with the same payee.
export const SAS_PAYEES = {
  setup: "15",
  program: "16",
  citadel: "15", // feeLegal (Citadel/Victory legal) pays out to 15
  service: "161",
  retainer: "179",
} as const;

export type SasOutboundMode = "test" | "live";

export function sasOutboundMode(): SasOutboundMode {
  return process.env.SAS_OUTBOUND_MODE === "live" ? "live" : "test";
}

type DraftForSync = Prisma.DraftGetPayload<{
  include: { programPlan: { include: { account: { select: { id: true; sfId: true; externalSasId: true } } } } };
}>;

interface SasPayout {
  PayeeID: string;
  Amount: string;
  PayoutDate: string;
}

interface SasDebit {
  DebitRemoteID: string;
  DebitID: string;
  Amount: string;
  Date: string;
  Payouts?: SasPayout[];
}

interface SasDebitSchedulePayload {
  CustomerID: string;
  RemoteID: string;
  DebitScheduleID: string;
  Debits: SasDebit[];
}

/** "2026-07-13 00:00:00" - matches Apex String.valueOf(Date) which SAS accepts. */
function sasDate(d: Date): string {
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
}

function money(n: number): string {
  return n.toFixed(2);
}

/**
 * Build the Payouts list for one draft from its fee buckets. Mirrors
 * FeeUtil.FEES_INTEGRATION_SUPPORTED_SAS: retainer/setup/service/program/
 * citadel(feeLegal). feeBank stays internal - SAS nets its own processor fee.
 */
function buildPayouts(d: DraftForSync): SasPayout[] {
  const date = sasDate(d.scheduledDate);
  const rows: Array<[string, number]> = [
    [SAS_PAYEES.retainer, d.feeRetainer],
    [SAS_PAYEES.setup, d.feeSetup],
    [SAS_PAYEES.program, d.feeProgram],
    [SAS_PAYEES.service, d.feeService],
    [SAS_PAYEES.citadel, d.feeLegal],
  ];
  return rows
    .filter(([, amount]) => amount > 0)
    .map(([PayeeID, amount]) => ({ PayeeID, Amount: money(amount), PayoutDate: date }));
}

function buildDebit(d: DraftForSync): SasDebit {
  const debit: SasDebit = {
    DebitRemoteID: d.id,
    DebitID: d.externalSasId ?? "",
    Amount: money(d.amount),
    Date: sasDate(d.scheduledDate),
  };
  const payouts = buildPayouts(d);
  if (payouts.length > 0) debit.Payouts = payouts;
  return debit;
}

/**
 * SAS customer id for the plan's account. SAS keys on either its numeric
 * customer id or the legacy SF account id (001VO...), both of which our
 * backfill stored in Account.externalSasId.
 */
function sasCustomerId(d: DraftForSync): string | null {
  return d.programPlan.account.externalSasId ?? null;
}

type SasMethod = "SetDebitSchedule" | "AddDebits" | "UpdateDebits" | "CancelDebits";

/** SF routing rules (ProcessorCreateAPI.createDraftAPIBulk). */
function classify(d: DraftForSync): SasMethod {
  const hasSchedule = Boolean(d.programPlan.externalDebitScheduleId);
  const hasSasId = Boolean(d.externalSasId);
  if (!hasSchedule && !hasSasId) return "SetDebitSchedule";
  if (!hasSasId) return "AddDebits";
  if (d.status === "CANCELLED" || d.status === "SKIPPED") return "CancelDebits";
  return "UpdateDebits";
}

interface SasLineResult {
  RemoteID?: string;
  DebitRemoteID?: string;
  ID?: string | number;
  DebitID?: string | number;
  Success?: boolean;
  Message?: string;
}

interface SasEnvelope {
  Success: boolean;
  Message?: string | null;
  ProcessData?: string | null;
  ResponseData?: unknown;
  ID?: string | number; // schedule id on SetDebitSchedule
}

async function sasPost(method: SasMethod, payload: SasDebitSchedulePayload): Promise<SasEnvelope> {
  // Reuse the read-client credential resolution (DB-first, env fallback).
  const { sasRawCall } = await import("./sas");
  return sasRawCall(method, payload) as Promise<SasEnvelope>;
}

export interface DrainResult {
  mode: SasOutboundMode;
  batches: Array<{
    programPlanId: string;
    method: SasMethod;
    draftCount: number;
    status: "DRY_RUN" | "SUCCESS" | "FAILED" | "SKIPPED_NO_CUSTOMER";
    error?: string;
  }>;
}

/**
 * Drain the PENDING processor-sync queue for SAS. Groups drafts by program
 * plan and method, builds SF-identical payloads, journals every batch, and in
 * live mode sends + applies the results (externalSasId, SYNCED/FAILED).
 */
export async function drainSasQueue(opts?: { programPlanId?: string }): Promise<DrainResult> {
  const mode = sasOutboundMode();
  const drafts = (await prisma.draft.findMany({
    where: {
      processorSyncStatus: "PENDING",
      ...(opts?.programPlanId ? { programPlanId: opts.programPlanId } : {}),
    },
    include: { programPlan: { include: { account: { select: { id: true, sfId: true, externalSasId: true } } } } },
    orderBy: { scheduledDate: "asc" },
    take: 500,
  })) as DraftForSync[];

  const result: DrainResult = { mode, batches: [] };
  if (drafts.length === 0) return result;

  // Group by plan, then by method - one SAS call per (plan, method).
  const byPlan = new Map<string, DraftForSync[]>();
  for (const d of drafts) {
    const list = byPlan.get(d.programPlanId) ?? [];
    list.push(d);
    byPlan.set(d.programPlanId, list);
  }

  for (const [programPlanId, planDrafts] of byPlan) {
    const customerId = sasCustomerId(planDrafts[0]);
    if (!customerId) {
      // Account was never enrolled with SAS - leave PENDING for the
      // enrollment flow (client creation) to pick up later.
      result.batches.push({ programPlanId, method: "SetDebitSchedule", draftCount: planDrafts.length, status: "SKIPPED_NO_CUSTOMER" });
      continue;
    }

    const byMethod = new Map<SasMethod, DraftForSync[]>();
    for (const d of planDrafts) {
      const m = classify(d);
      const list = byMethod.get(m) ?? [];
      list.push(d);
      byMethod.set(m, list);
    }

    for (const [method, methodDrafts] of byMethod) {
      const payload: SasDebitSchedulePayload = {
        CustomerID: customerId,
        RemoteID: methodDrafts[0].programPlan.account.sfId ?? methodDrafts[0].programPlan.account.id,
        DebitScheduleID: methodDrafts[0].programPlan.externalDebitScheduleId ?? "",
        Debits: methodDrafts.map(buildDebit),
      };
      const draftIds = methodDrafts.map((d) => d.id);

      if (mode === "test") {
        await prisma.processorSyncLog.create({
          data: { provider: "SAS", method, mode: "TEST", status: "DRY_RUN", payload: payload as unknown as Prisma.InputJsonValue, draftIds },
        });
        result.batches.push({ programPlanId, method, draftCount: methodDrafts.length, status: "DRY_RUN" });
        continue;
      }

      try {
        const res = await sasPost(method, payload);
        await prisma.processorSyncLog.create({
          data: {
            provider: "SAS",
            method,
            mode: "LIVE",
            status: res.Success ? "SUCCESS" : "FAILED",
            payload: payload as unknown as Prisma.InputJsonValue,
            response: res as unknown as Prisma.InputJsonValue,
            error: res.Success ? null : (res.Message ?? "Success=false"),
            draftIds,
          },
        });
        if (!res.Success) throw new Error(res.Message ?? "SAS returned Success=false");

        // Per-line results: match SF parseResponse - each line carries the SF
        // (Remote) id and the SAS debit id.
        let lines: SasLineResult[] = [];
        if (res.ProcessData) {
          try {
            const parsed = JSON.parse(res.ProcessData) as unknown;
            if (Array.isArray(parsed)) lines = parsed as SasLineResult[];
          } catch {
            /* schedule-level success without line detail is still a success */
          }
        }
        const sasIdByDraft = new Map<string, string>();
        for (const line of lines) {
          const remote = line.RemoteID ?? line.DebitRemoteID;
          const sasId = line.DebitID ?? line.ID;
          if (remote && sasId != null) sasIdByDraft.set(String(remote), String(sasId));
        }

        await prisma.$transaction([
          ...methodDrafts.map((d) =>
            prisma.draft.update({
              where: { id: d.id },
              data: {
                processorSyncStatus: "SYNCED",
                ...(sasIdByDraft.has(d.id) ? { externalSasId: sasIdByDraft.get(d.id) } : {}),
              },
            }),
          ),
          // SetDebitSchedule returns the new schedule id - persist on the plan.
          ...(method === "SetDebitSchedule" && res.ID != null
            ? [prisma.programPlan.update({ where: { id: programPlanId }, data: { externalDebitScheduleId: String(res.ID) } })]
            : []),
        ]);
        result.batches.push({ programPlanId, method, draftCount: methodDrafts.length, status: "SUCCESS" });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await prisma.draft.updateMany({ where: { id: { in: draftIds } }, data: { processorSyncStatus: "FAILED" } });
        result.batches.push({ programPlanId, method, draftCount: methodDrafts.length, status: "FAILED", error });
      }
    }
  }
  return result;
}
