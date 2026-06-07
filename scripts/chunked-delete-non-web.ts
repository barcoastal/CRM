/**
 * Chunked DELETE: pull batches of non-Web-Lead ids, delete each batch in a
 * small transaction so the table lock releases between chunks and the app
 * stays responsive.
 */
import { Client } from "pg";

const WEB_LEAD_RT = "012VO000002NUlrYAG";
const BATCH = 5000;

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("SET statement_timeout = 0");

  const startCount = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`Starting Lead count: ${startCount.rows[0].c}`);

  let deleted = 0;
  let pass = 0;
  while (true) {
    pass++;
    // Pull a chunk of non-Web-Lead ids
    const r = await pg.query(
      `SELECT id FROM "Lead" WHERE "sfId" IS NOT NULL AND ("sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM $1 LIMIT $2`,
      [WEB_LEAD_RT, BATCH],
    );
    if (r.rowCount === 0) break;
    const ids = r.rows.map((row: { id: string }) => row.id);

    // Null FKs on tables that allow null
    for (const table of ["Call", "Task", "Event", "EmailMessage", "SmsMessage", "Opportunity", "Document", "Envelope"]) {
      try {
        await pg.query(`UPDATE "${table}" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [ids]);
      } catch { /* table may not exist or column may not be nullable */ }
    }

    // Delete child rows that strictly require Lead
    for (const table of ["LeadDebt", "LeadPaymentCalculation", "LeadHistory", "CampaignContact"]) {
      try {
        await pg.query(`DELETE FROM "${table}" WHERE "leadId" = ANY($1::text[])`, [ids]);
      } catch { /* may not exist */ }
    }

    // Delete the leads
    const d = await pg.query(`DELETE FROM "Lead" WHERE id = ANY($1::text[])`, [ids]);
    deleted += d.rowCount ?? 0;

    if (pass % 5 === 0 || (d.rowCount ?? 0) < BATCH) {
      console.log(`  pass ${pass}: deleted ${deleted} so far`);
    }
  }

  console.log(`\nTotal deleted: ${deleted}`);

  // Update remaining Web Leads' recordType
  const u = await pg.query(
    `UPDATE "Lead" SET "recordType" = 'WEB' WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = $1 AND "recordType" != 'WEB'`,
    [WEB_LEAD_RT],
  );
  console.log(`Tagged ${u.rowCount} Web Leads.`);

  const endCount = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`Final Lead count: ${endCount.rows[0].c}`);

  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
