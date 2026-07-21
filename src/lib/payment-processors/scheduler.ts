/**
 * Recurring processor status poll - pulls draft statuses (cleared / NSF /
 * return codes) and escrow balances straight from SAS + RAM every 30 minutes,
 * so payment truth no longer depends on the Salesforce nightly sync.
 *
 * Boot-armed from instrumentation.ts. Skips silently when processor
 * credentials are absent (e.g. local dev without the creds row).
 */
import { runProcessorSync } from "./index";

const INTERVAL_MS = 30 * 60 * 1000;
let running = false;
let armed = false;
let lastRun: { at: string; result: unknown } | null = null;

export function getLastPollResult(): { at: string; result: unknown } | null {
  return lastRun;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await runProcessorSync({ since });
    lastRun = { at: new Date().toISOString(), result };
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
