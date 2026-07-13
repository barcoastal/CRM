/**
 * In-app Salesforce sync runner. Spawns the migration script per entity
 * (account -> contact -> opportunity -> programplan -> draft -> lead)
 * inside the Railway container.
 * State is kept in-process; progress is appended to /tmp/sf-sync.log.
 *
 * Requires env: DATABASE_URL (native to the app) and SF_AUTH_URL (the
 * force://... sfdx auth url used for Bulk API exports).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOG_PATH = "/tmp/sf-sync.log";
// Plans before drafts (drafts FK onto plans); lead last (largest table).
const ENTITIES = ["account", "contact", "opportunity", "programplan", "draft", "debt", "fee", "case", "task", "event", "emailmessage", "lead"] as const;

export interface SyncStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  current: string | null;
  lastResult: string | null;
}

const status: SyncStatus = { running: false, startedAt: null, finishedAt: null, current: null, lastResult: null };

function log(line: string): void {
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  try {
    fs.appendFileSync(LOG_PATH, msg);
  } catch {
    // ignore
  }
  console.log(`[sf-sync] ${line}`);
}

function runEntity(entity: string): Promise<number> {
  return new Promise((resolve) => {
    const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const child = spawn(tsx, ["scripts/migrate-sf-objects.ts", entity], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d: Buffer) => fs.appendFileSync(LOG_PATH, d));
    child.stderr.on("data", (d: Buffer) => fs.appendFileSync(LOG_PATH, d));
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (e) => {
      log(`spawn error for ${entity}: ${e.message}`);
      resolve(1);
    });
  });
}

/** Kick off a full sync if one isn't already running. Returns immediately. */
export function startSfSync(trigger: string): { started: boolean; reason?: string } {
  if (status.running) return { started: false, reason: "already running" };
  if (!process.env.SF_AUTH_URL) return { started: false, reason: "SF_AUTH_URL not set" };

  status.running = true;
  status.startedAt = new Date().toISOString();
  status.finishedAt = null;
  status.lastResult = null;

  void (async () => {
    log(`=== sync started (${trigger}) ===`);
    const failures: string[] = [];
    for (const entity of ENTITIES) {
      status.current = entity;
      log(`syncing ${entity}...`);
      const code = await runEntity(entity);
      if (code !== 0) {
        failures.push(entity);
        log(`${entity} FAILED (exit ${code})`);
      } else {
        log(`${entity} done`);
      }
    }
    status.running = false;
    status.current = null;
    status.finishedAt = new Date().toISOString();
    status.lastResult = failures.length ? `failed: ${failures.join(", ")}` : "success";
    log(`=== sync finished: ${status.lastResult} ===`);
  })();

  return { started: true };
}

export function getSfSyncStatus(): SyncStatus & { logTail: string } {
  let logTail = "";
  try {
    const raw = fs.readFileSync(LOG_PATH, "utf8");
    logTail = raw.split("\n").slice(-30).join("\n");
  } catch {
    // no log yet
  }
  return { ...status, logTail };
}

/**
 * Schedule the nightly run. Fires daily at SF_SYNC_UTC_HOUR (default 02:00
 * UTC = 05:00 Israel time). Called once from instrumentation.ts at boot.
 */
export function scheduleNightlySfSync(): void {
  const hour = Number(process.env.SF_SYNC_UTC_HOUR ?? 2);
  const msUntil = (): number => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  };
  const arm = (): void => {
    setTimeout(() => {
      startSfSync("nightly schedule");
      arm(); // re-arm for the next day
    }, msUntil()).unref();
  };
  if (process.env.SF_AUTH_URL) {
    arm();
    console.log(`[sf-sync] nightly sync armed for ${String(hour).padStart(2, "0")}:00 UTC`);
  } else {
    console.log("[sf-sync] SF_AUTH_URL not set - nightly sync disabled");
  }
}
