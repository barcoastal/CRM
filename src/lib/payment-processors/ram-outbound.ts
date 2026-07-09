/**
 * RAM outbound draft sync - pushes CRM draft changes to RAM (ramservicing.com).
 *
 * Port of SF RAMApi createDraftService / updateDraftService / cancelDraftService.
 * SOAP calls dispatched via the `Method:` HTTP header:
 *
 *   no externalRamId            -> PayScheduleAddSingle   (Method: CreateDraftAndFees)
 *   externalRamId + CANCELLED/
 *     SKIPPED                   -> PayScheduleUpdateSingle with ALL amounts zeroed
 *   externalRamId otherwise     -> PayScheduleUpdateSingle (Method: UpdateDraftAndFees)
 *
 * Idempotency mirrors SF: before a create we ask GetPaymentIDByExtendedID
 * (extendedID = our draft id); if RAM already has it we update instead.
 *
 * Element mapping (RAMWrapper.createDraftMap/updateDraftMap + RAM_Fee_Map_Setting__mdt):
 *   clientID           account.externalRamId
 *   extendedID / PID   draft.id / draft.externalRamId
 *   TotalPaymentAmount amount minus the monthly processor (bank) fee
 *   savings            escrowAmount
 *   paymentdate        yyyy-mm-dd
 *   fee1=retainer  fee2=setup+citadel(feeLegal)  fee3=service  fee4=program
 *
 * Same test-mode gate as SAS: RAM_OUTBOUND_MODE=live to send, otherwise every
 * payload is journaled to ProcessorSyncLog as DRY_RUN.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ramTransport } from "./ram";

export type RamOutboundMode = "test" | "live";

export function ramOutboundMode(): RamOutboundMode {
  return process.env.RAM_OUTBOUND_MODE === "live" ? "live" : "test";
}

type DraftForSync = Prisma.DraftGetPayload<{
  include: { programPlan: { include: { account: { select: { id: true; sfId: true; externalRamId: true } } } } };
}>;

type RamMethod = "CreateDraftAndFees" | "UpdateDraftAndFees" | "CancelDraft";

function ramDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return n.toFixed(2);
}

interface RamDraftFields {
  bodyElement: "PayScheduleAddSingle" | "PayScheduleUpdateSingle";
  methodHeader: "CreateDraftAndFees" | "UpdateDraftAndFees";
  elements: Record<string, string>;
}

function classify(d: DraftForSync): RamMethod {
  if (!d.externalRamId) return "CreateDraftAndFees";
  if (d.status === "CANCELLED" || d.status === "SKIPPED") return "CancelDraft";
  return "UpdateDraftAndFees";
}

/** Build the SOAP child elements for one draft, per the SF field maps. */
function buildFields(d: DraftForSync, method: RamMethod): RamDraftFields {
  const zero = method === "CancelDraft";
  const clientId = d.programPlan.account.externalRamId ?? "";
  const totalExclBank = Math.round((d.amount - d.feeBank) * 100) / 100;

  const elements: Record<string, string> = {
    clientID: clientId,
    TotalPaymentAmount: money(zero ? 0 : totalExclBank),
    savings: money(zero ? 0 : d.escrowAmount),
    paymentdate: ramDate(d.scheduledDate),
    fee1: money(zero ? 0 : d.feeRetainer),
    fee2: money(zero ? 0 : d.feeSetup + d.feeLegal),
    fee3: money(zero ? 0 : d.feeService),
    fee4: money(zero ? 0 : d.feeProgram),
  };

  if (method === "CreateDraftAndFees") {
    elements.extendedID = d.id;
    return { bodyElement: "PayScheduleAddSingle", methodHeader: "CreateDraftAndFees", elements };
  }
  elements.PID = d.externalRamId ?? "";
  return { bodyElement: "PayScheduleUpdateSingle", methodHeader: "UpdateDraftAndFees", elements };
}

function toXml(elements: Record<string, string>, sessionId: string): string {
  const parts = [`<Sessid>${ramTransport.escape(sessionId)}</Sessid>`];
  for (const [k, v] of Object.entries(elements)) {
    parts.push(`<${k}>${ramTransport.escape(v)}</${k}>`);
  }
  return parts.join("");
}

/** SF getPaymentIdByExtendedId - RAM's id for a draft we already pushed. */
async function getPaymentIdByExtendedId(extendedId: string): Promise<string | null> {
  const sessionId = await ramTransport.session();
  const xml = await ramTransport.call(
    "GetPaymentIDByExtendedID",
    "GetPaymentIDByExtendedID",
    `<sessid>${ramTransport.escape(sessionId)}</sessid><extendedID>${ramTransport.escape(extendedId)}</extendedID>`,
  );
  // Result children: [0]="OK"|error, [1]=paymentId
  const strings = ramTransport.extract(xml, "string");
  if (strings.length >= 2 && strings[0].toUpperCase() === "OK" && strings[1]) return strings[1];
  return null;
}

export interface RamDrainResult {
  mode: RamOutboundMode;
  batches: Array<{
    programPlanId: string;
    draftId: string;
    method: RamMethod;
    status: "DRY_RUN" | "SUCCESS" | "FAILED" | "SKIPPED_NO_CUSTOMER";
    error?: string;
  }>;
}

/**
 * Drain PENDING drafts whose account is RAM-enrolled. RAM is one call per
 * draft (no bulk endpoint), matching the SF integration.
 */
export async function drainRamQueue(opts?: { programPlanId?: string }): Promise<RamDrainResult> {
  const mode = ramOutboundMode();
  const drafts = (await prisma.draft.findMany({
    where: {
      processorSyncStatus: "PENDING",
      programPlan: { account: { externalRamId: { not: null } } },
      ...(opts?.programPlanId ? { programPlanId: opts.programPlanId } : {}),
    },
    include: { programPlan: { include: { account: { select: { id: true, sfId: true, externalRamId: true } } } } },
    orderBy: { scheduledDate: "asc" },
    take: 200,
  })) as DraftForSync[];

  const result: RamDrainResult = { mode, batches: [] };

  for (const d of drafts) {
    let method = classify(d);

    if (mode === "test") {
      const fields = buildFields(d, method);
      await prisma.processorSyncLog.create({
        data: {
          provider: "RAM",
          method: fields.bodyElement,
          mode: "TEST",
          status: "DRY_RUN",
          payload: { methodHeader: fields.methodHeader, ...fields.elements } as unknown as Prisma.InputJsonValue,
          draftIds: [d.id],
        },
      });
      result.batches.push({ programPlanId: d.programPlanId, draftId: d.id, method, status: "DRY_RUN" });
      continue;
    }

    try {
      // SF idempotency check before create.
      if (method === "CreateDraftAndFees") {
        const existing = await getPaymentIdByExtendedId(d.id).catch(() => null);
        if (existing) {
          await prisma.draft.update({ where: { id: d.id }, data: { externalRamId: existing } });
          d.externalRamId = existing;
          method = classify(d);
        }
      }
      const fields = buildFields(d, method);
      const sessionId = await ramTransport.session();
      const xml = await ramTransport.call(fields.bodyElement, fields.methodHeader, toXml(fields.elements, sessionId));

      // Result children: [0]="OK", [1]=paymentId (create only)
      const strings = ramTransport.extract(xml, "string");
      const ok = strings.length > 0 && strings[0].toUpperCase() === "OK";
      const paymentId = ok && strings.length >= 2 ? strings[1] : null;

      await prisma.processorSyncLog.create({
        data: {
          provider: "RAM",
          method: fields.bodyElement,
          mode: "LIVE",
          status: ok ? "SUCCESS" : "FAILED",
          payload: { methodHeader: fields.methodHeader, ...fields.elements } as unknown as Prisma.InputJsonValue,
          response: { strings: strings.slice(0, 6) } as unknown as Prisma.InputJsonValue,
          error: ok ? null : (strings[0] ?? "no OK in response"),
          draftIds: [d.id],
        },
      });
      if (!ok) throw new Error(strings[0] ?? "RAM response missing OK");

      await prisma.draft.update({
        where: { id: d.id },
        data: {
          processorSyncStatus: "SYNCED",
          ...(paymentId && !d.externalRamId ? { externalRamId: paymentId } : {}),
        },
      });
      result.batches.push({ programPlanId: d.programPlanId, draftId: d.id, method, status: "SUCCESS" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await prisma.draft.update({ where: { id: d.id }, data: { processorSyncStatus: "FAILED" } });
      result.batches.push({ programPlanId: d.programPlanId, draftId: d.id, method, status: "FAILED", error });
    }
  }
  return result;
}
