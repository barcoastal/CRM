/**
 * Backfill User.sfId so we can resolve SF OwnerId → CRM User in renders.
 * Matches by email.
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";

async function main() {
  console.log("Pulling SF Users…");
  const res = spawnSync(
    "sf",
    ["data", "query", "--target-org", "coastal", "-q", "SELECT Id, Email, Name FROM User", "--json"],
    { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    console.error("SF query failed:", res.stderr?.slice(0, 300));
    process.exit(1);
  }
  const parsed = JSON.parse(res.stdout) as { result?: { records?: Array<{ Id: string; Email: string; Name: string }> } };
  const users = parsed.result?.records ?? [];
  console.log(`Got ${users.length} SF users`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  let updated = 0;
  for (const u of users) {
    if (!u.Email) continue;
    const r = await pg.query(
      `UPDATE "User" SET "sfId" = $1 WHERE "email" = $2 AND ("sfId" IS NULL OR "sfId" != $1) RETURNING id`,
      [u.Id, u.Email.toLowerCase()],
    );
    if (r.rowCount && r.rowCount > 0) updated++;
  }
  console.log(`Updated ${updated} CRM users with sfId`);
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
