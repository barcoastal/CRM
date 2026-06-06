/**
 * Delete rows whose sfId is not a valid SF ID (15-18 char alphanumeric).
 * These came from the CSV parser failing on multi-line cells and scrambling
 * column values.
 */
import { Client } from "pg";
const ENTITY = process.argv[2];
const TABLE = ENTITY === "lead" ? "Lead" : ENTITY === "contact" ? "Contact" : ENTITY === "account" ? "Account" : ENTITY === "opportunity" ? "Opportunity" : null;
if (!TABLE) { console.error("Usage: tsx cleanup-corrupt.ts <lead|contact|account|opportunity>"); process.exit(1); }

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`DELETE FROM "${TABLE}" WHERE "sfId" IS NOT NULL AND "sfId" !~ '^[a-zA-Z0-9]{15,18}$' RETURNING "sfId"`);
  console.log(`Deleted ${r.rowCount} corrupt ${TABLE} rows.`);
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
