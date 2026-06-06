import { Client } from "pg";
async function main() {
  const sfId = process.argv[2];
  const contactName = process.argv[3];
  if (!sfId || !contactName) {
    console.error("Usage: tsx fix-one-lead.ts <sfId> <contactName>");
    process.exit(1);
  }
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`UPDATE "Lead" SET "contactName" = $1 WHERE "sfId" = $2 RETURNING id, "contactName"`, [contactName, sfId]);
  console.log(r.rows);
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
