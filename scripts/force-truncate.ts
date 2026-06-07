/**
 * Force-truncate: terminate all competing connections, take ACCESS EXCLUSIVE
 * lock, TRUNCATE, restore keepers. Snapshot table must already exist (from
 * snapshot-truncate-restore.ts run).
 */
import { Client } from "pg";

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("SET statement_timeout = 0");
  await pg.query("SET lock_timeout = 60000");

  // 1. Verify snapshot exists
  const snap = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead_keep"`);
  console.log(`Snapshot has ${snap.rows[0].c} keepers.`);

  // 2. Kill all OTHER active connections touching Lead
  console.log("Terminating competing backends…");
  const k = await pg.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'railway'
      AND pid != pg_backend_pid()
      AND state IN ('active', 'idle in transaction')
  `);
  console.log(`  terminated ${k.rowCount} connections`);

  // 3. TRUNCATE (should be near-instant now)
  console.log("TRUNCATE Lead…");
  const t0 = Date.now();
  await pg.query(`TRUNCATE "Lead" CASCADE`);
  console.log(`  done in ${Date.now() - t0}ms`);

  // 4. Restore keepers
  console.log("INSERT keepers back…");
  const ins = await pg.query(`INSERT INTO "Lead" SELECT * FROM "Lead_keep"`);
  console.log(`  inserted ${ins.rowCount}`);

  // 5. Tag recordType
  await pg.query(`UPDATE "Lead" SET "recordType" = 'WEB' WHERE "recordType" != 'WEB'`);

  // 6. Drop snapshot
  await pg.query(`DROP TABLE "Lead_keep"`);
  console.log("Snapshot dropped.");

  const end = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead"`);
  console.log(`Final Lead count: ${end.rows[0].c}`);

  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
