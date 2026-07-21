/**
 * Payment processor orchestrator — pulls escrow balances + draft updates
 * from RAM and SAS and writes them back to Account / Draft rows.
 *
 * Replaces SF Batch_RAM_GetEscrowBalance, Batch_SAS_GetEscrowBalance,
 * Batch_RAM_GetDraftUpdates, Batch_SAS_GetDraftUpdates.
 */

import { prisma } from "@/lib/prisma";
import { ramProvider } from "./ram";
import { sasProvider } from "./sas";
import type { BalanceUpdate, DraftUpdate, PaymentProcessor } from "./types";

export { ramProvider, sasProvider };
export type { BalanceUpdate, DraftUpdate, PaymentProcessor };

export function getProvider(name: "RAM" | "SAS" | "RELIANT"): PaymentProcessor {
  if (name === "RAM" || name === "RELIANT") return ramProvider;
  return sasProvider;
}

/**
 * Pull recent balance updates from a provider and apply them to matching
 * Accounts. Matches by Account.externalRamId / externalSasId.
 */
export async function syncBalances(
  provider: PaymentProcessor,
  sinceISO: string
): Promise<{ provider: string; matched: number; updated: number }> {
  const updates = await provider.listUpdatedBalances(sinceISO);
  const idField = provider.name === "SAS" ? "externalSasId" : "externalRamId";

  let updated = 0;
  for (const u of updates) {
    const acct = await prisma.account.findFirst({
      where: u.sfAccountId
        ? { OR: [{ [idField]: u.externalAccountId }, { sfId: u.sfAccountId }] }
        : { [idField]: u.externalAccountId },
      select: { id: true },
    });
    if (!acct) continue;
    await prisma.account.update({
      where: { id: acct.id },
      data: { escrowBalance: u.balance, escrowPulledAt: u.pulledAt },
    });
    updated++;
  }
  return { provider: provider.name, matched: updates.length, updated };
}

/**
 * Pull draft updates from a provider, match on processorReference, and
 * upgrade status (using the same rank logic as smsTrigger so we don't
 * downgrade a SUCCESS to SCHEDULED).
 */
const STATUS_RANK: Record<string, number> = {
  SCHEDULED: 0,
  RETRYING: 1,
  PROCESSING: 1,
  SUCCESS: 2,
  SKIPPED: 4,
  FAILED: 5,
  CANCELLED: 5,
};

export async function syncDrafts(
  provider: PaymentProcessor,
  sinceISO: string
): Promise<{ provider: string; matched: number; updated: number }> {
  const updates = await provider.getDraftUpdates(sinceISO);
  // Drafts carry the processor's id in externalSasId / externalRamId (synced
  // from SF or written by our own outbound push); processorReference is a
  // legacy fallback.
  const idField = provider.name === "SAS" ? "externalSasId" : "externalRamId";
  let updated = 0;
  for (const u of updates) {
    if (!u.externalDraftId) continue;
    const or: Array<Record<string, string>> = [
      { [idField]: u.externalDraftId },
      { processorReference: u.externalDraftId },
    ];
    if (u.sfDraftId) or.push({ sfId: u.sfDraftId });
    const draft = await prisma.draft.findFirst({
      where: { OR: or },
      select: { id: true, status: true },
    });
    if (!draft) continue;
    const incomingRank = STATUS_RANK[u.status] ?? 0;
    const existingRank = STATUS_RANK[draft.status] ?? 0;
    if (incomingRank < existingRank) continue;
    await prisma.draft.update({
      where: { id: draft.id },
      data: {
        status: u.status,
        processedAt: u.processedAt ? new Date(u.processedAt) : undefined,
        settledAt: u.settledAt ? new Date(u.settledAt) : undefined,
        returnCode: u.returnCode ?? undefined,
        returnReason: u.returnReason ?? undefined,
      },
    });
    updated++;
  }
  return { provider: provider.name, matched: updates.length, updated };
}

/**
 * One-shot sync. Defaults to "yesterday" anchor — matches the SF batch
 * default of Datetime.now().addDays(-1).format('yyyy-MM-dd').
 */
export async function runProcessorSync(opts: { since?: string; only?: "RAM" | "SAS" } = {}): Promise<{
  balances: Array<{ provider: string; matched: number; updated: number }>;
  drafts: Array<{ provider: string; matched: number; updated: number }>;
}> {
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const providers: PaymentProcessor[] = [];
  if (!opts.only || opts.only === "SAS") providers.push(sasProvider);
  if (!opts.only || opts.only === "RAM") providers.push(ramProvider);

  const balances: Array<{ provider: string; matched: number; updated: number }> = [];
  const drafts: Array<{ provider: string; matched: number; updated: number }> = [];

  for (const p of providers) {
    try {
      balances.push(await syncBalances(p, since));
    } catch (e: unknown) {
      balances.push({ provider: p.name, matched: 0, updated: 0 });
      console.error(`[${p.name}] syncBalances failed`, e);
    }
    try {
      drafts.push(await syncDrafts(p, since));
    } catch (e: unknown) {
      drafts.push({ provider: p.name, matched: 0, updated: 0 });
      console.error(`[${p.name}] syncDrafts failed`, e);
    }
  }

  return { balances, drafts };
}
