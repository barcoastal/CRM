/**
 * Recurring processor status poll - pulls draft statuses (cleared / NSF /
 * return codes) and escrow balances straight from SAS + RAM every 30 minutes,
 * so payment truth no longer depends on the Salesforce nightly sync.
 *
 * Boot-armed from instrumentation.ts. Skips silently when processor
 * credentials are absent (e.g. local dev without the creds row).
 */
import { runProcessorSync } from "./index";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const INTERVAL_MS = 30 * 60 * 1000;
let running = false;
let armed = false;

/**
 * Last automatic run, read from the journal (module state does NOT survive
 * Next.js bundle boundaries between instrumentation and route handlers).
 */
export async function getLastPollResult(): Promise<{ at: string; result: unknown } | null> {
  const row = await prisma.processorSyncLog.findFirst({
    where: { provider: "POLL", method: "StatusPoll" },
    orderBy: { createdAt: "desc" },
  });
  return row ? { at: row.createdAt.toISOString(), result: row.response } : null;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await runProcessorSync({ since });
    await prisma.processorSyncLog.create({
      data: {
        provider: "POLL",
        method: "StatusPoll",
        mode: "LIVE",
        status: "SUCCESS",
        payload: { since } as Prisma.InputJsonValue,
        response: result as unknown as Prisma.InputJsonValue,
        draftIds: [],
      },
    });
    const fmt = (rows: Array<{ provider: string; matched: number; updated: number }>) =>
      rows.map((r) => `${r.provider} ${r.updated}/${r.matched}`).join(", ");
    console.log(`[processor-poll] drafts: ${fmt(result.drafts)} | balances: ${fmt(result.balances)}`);
  } catch (e) {
    console.error("[processor-poll] failed:", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

export function scheduleProcessorPolling(): void {
  if (armed) return;
  armed = true;
  // First run shortly after boot, then every 30 minutes.
  setTimeout(() => void tick(), 90_000);
  setInterval(() => void tick(), INTERVAL_MS);
  console.log("[processor-poll] armed (every 30 minutes)");
}
