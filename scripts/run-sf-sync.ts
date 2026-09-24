import fs from "node:fs";
import path from "node:path";
import { checkpointedEntity, SYNC_ENTITIES } from "../src/lib/sf-sync/checkpoint-runner";

async function main() {
  const stateDir = process.env.SF_SYNC_STATE_DIR;
  if (!stateDir) throw new Error("SF_SYNC_STATE_DIR must point to persistent storage");
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(stateDir, "sync.lock");
  try {
    const fd = fs.openSync(lockPath, "wx", 0o600); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const pid = Number(fs.readFileSync(lockPath, "utf8"));
    try { process.kill(pid, 0); console.log("A Salesforce sync is already running."); return; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
    fs.unlinkSync(lockPath);
    const fd = fs.openSync(lockPath, "wx", 0o600); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  }
  try {
    const selected = process.argv.slice(2);
    const entities = selected.length ? selected : [...SYNC_ENTITIES];
    const failures: string[] = [];
    console.log(`=== Salesforce sync started ${new Date().toISOString()} ===`);
    for (const entity of entities) {
      let code = 1;
      try { code = await checkpointedEntity(entity, { stateDir, since: process.env.SF_SINCE, log: line => process.stdout.write(line) }); }
      catch { console.error(`${entity}: runner error; checkpoint retained`); }
      if (code !== 0) failures.push(entity);
    }
    console.log(`=== Salesforce sync finished: ${failures.length ? `FAILED ${failures.join(", ")}` : "success"} ===`);
    process.exitCode = failures.length ? 1 : 0;
  } finally { fs.unlinkSync(lockPath); }
}
main().catch(() => { console.error("Salesforce sync runner failed; checkpoint retained"); process.exitCode = 1; });
