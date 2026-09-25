import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { nextWindow, type Checkpoint } from "./reliable";

export const SYNC_ENTITIES = ["account", "contact", "opportunity", "programplan", "draft", "debt", "fee", "case", "offer", "settlement", "paymentsummary", "lead", "task", "event", "emailmessage"] as const;

export async function checkpointedEntity(entity: string, options: {
  stateDir: string; log: (line: string) => void; since?: string; now?: Date;
  execute?: (env: Record<string, string>) => Promise<number>;
}) {
  if (!(SYNC_ENTITIES as readonly string[]).includes(entity)) throw new Error("Unsupported sync entity");
  fs.mkdirSync(options.stateDir, { recursive: true, mode: 0o700 });
  const checkpointPath = path.join(options.stateDir, `${entity}.json`);
  let checkpoint: Checkpoint | null = null;
  if (fs.existsSync(checkpointPath)) checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  const { since, until } = nextWindow(checkpoint, options.now ?? new Date(), options.since);
  const env = { SF_SINCE: since, SF_UNTIL: until, SF_SYNC: "1", SF_CSV_PATH: path.join(options.stateDir, `${entity}.csv`) };
  const execute = options.execute ?? (async (environment: Record<string, string>) => new Promise<number>(resolve => {
    const child = spawn(path.join(process.cwd(), "node_modules/.bin/tsx"), ["scripts/migrate-sf-objects.ts", entity], {
      cwd: process.cwd(), env: { ...process.env, ...environment }, stdio: ["ignore", "pipe", "pipe"], detached: true,
    });
    child.stdout.on("data", data => options.log(String(data)));
    child.stderr.on("data", data => options.log(String(data)));
    const timeout = setTimeout(() => {
      options.log(`${entity}: timeout; retaining checkpoint\n`);
      if (child.pid) try { process.kill(-child.pid, "SIGTERM"); } catch { /* process already ended */ }
    }, 30 * 60_000);
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    timeout.unref();
    // Kill only this process group, never another sync's processes.
    killTimer = setTimeout(() => { if (child.pid) try { process.kill(-child.pid, "SIGKILL"); } catch { /* ended */ } }, 30 * 60_000 + 10_000);
    killTimer.unref();
    child.on("error", () => { clearTimeout(timeout); clearTimeout(killTimer); resolve(1); });
    child.on("close", code => { clearTimeout(timeout); clearTimeout(killTimer); resolve(code ?? 1); });
  }));
  options.log(`${entity}: syncing ${since} through ${until}\n`);
  let code = 1;
  for (let attempt = 1; attempt <= 2; attempt++) {
    code = await execute(env);
    if (code === 0) break;
    options.log(`${entity}: attempt ${attempt} failed; checkpoint unchanged\n`);
  }
  if (code === 0) {
    const temporary = `${checkpointPath}.${process.pid}.partial`;
    fs.writeFileSync(temporary, JSON.stringify({ completedThrough: until, completedAt: new Date().toISOString() }), { mode: 0o600 });
    fs.renameSync(temporary, checkpointPath);
  }
  return code;
}
