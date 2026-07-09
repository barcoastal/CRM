/**
 * Outbound processor dispatch - one entry point that drains the PENDING draft
 * queue to whichever processor each account is enrolled with:
 *
 *   account.externalRamId set -> RAM (SOAP, one call per draft)
 *   otherwise                 -> SAS (JSON, batched per plan+method)
 *
 * Both providers honor their own *_OUTBOUND_MODE env (default: test/DRY_RUN).
 */

import { drainSasQueue, type DrainResult } from "./sas-outbound";
import { drainRamQueue, type RamDrainResult } from "./ram-outbound";

export interface OutboundResult {
  sas: DrainResult;
  ram: RamDrainResult;
}

export async function drainProcessorQueues(opts?: { programPlanId?: string }): Promise<OutboundResult> {
  const [sas, ram] = await Promise.all([
    drainSasQueue(opts).catch((e): DrainResult => {
      console.error("[processor-sync] SAS drain failed:", e instanceof Error ? e.message : e);
      return { mode: "test", batches: [] };
    }),
    drainRamQueue(opts).catch((e): RamDrainResult => {
      console.error("[processor-sync] RAM drain failed:", e instanceof Error ? e.message : e);
      return { mode: "test", batches: [] };
    }),
  ]);
  return { sas, ram };
}
