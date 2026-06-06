/**
 * DESTRUCTIVE: Keep only SF "Web Lead" record type (012VO000002NUlrYAG).
 * Confirmed by Bar 2026-06-06.
 */
import { Client } from "pg";

const WEB_LEAD_RT = "012VO000002NUlrYAG";

async function safe(pg: Client, label: string, sql: string, params: unknown[]) {
  try {
    await pg.query(sql, params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fail";
    if (!msg.includes("does not exist")) {
      console.error(`  ${label}: ${msg.slice(0, 120)}`);
    }
  }
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const before = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`Leads with sfId before: ${before.rows[0].c}`);
  const willKeep = await pg.query(
    `SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = $1`,
    [WEB_LEAD_RT],
  );
  console.log(`Will keep (Web Lead RT): ${willKeep.rows[0].c}`);

  console.log("\nFinding rows to delete…");
  const toDelete = await pg.query(
    `SELECT id FROM "Lead" WHERE ("sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM $1 AND "sfId" IS NOT NULL`,
    [WEB_LEAD_RT],
  );
  const ids: string[] = toDelete.rows.map((r: { id: string }) => r.id);
  console.log(`  ${ids.length} non-Web-Lead rows to delete`);

  const BATCH = 2000;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    // Null out FKs on tables that allow null so the Lead delete cascades or stays safe
    await safe(pg, "Call.leadId NULL", `UPDATE "Call" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "Task.leadId NULL", `UPDATE "Task" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "Event.leadId NULL", `UPDATE "Event" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "EmailMessage.leadId NULL", `UPDATE "EmailMessage" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "SmsMessage.leadId NULL", `UPDATE "SmsMessage" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "Opportunity.leadId NULL", `UPDATE "Opportunity" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "Document.leadId NULL", `UPDATE "Document" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "Envelope.leadId NULL", `UPDATE "Envelope" SET "leadId" = NULL WHERE "leadId" = ANY($1::text[])`, [batch]);
    // Delete fully-dependent children
    await safe(pg, "LeadDebt delete", `DELETE FROM "LeadDebt" WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "LeadPaymentCalculation delete", `DELETE FROM "LeadPaymentCalculation" WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "LeadHistory delete", `DELETE FROM "LeadHistory" WHERE "leadId" = ANY($1::text[])`, [batch]);
    await safe(pg, "CampaignContact delete", `DELETE FROM "CampaignContact" WHERE "leadId" = ANY($1::text[])`, [batch]);
    // The Lead itself
    try {
      const r = await pg.query(`DELETE FROM "Lead" WHERE id = ANY($1::text[])`, [batch]);
      deleted += r.rowCount ?? 0;
    } catch (e: unknown) {
      console.error(`  Lead delete batch ${i} failed:`, e instanceof Error ? e.message.slice(0, 200) : "fail");
    }
    if (i % 20000 < BATCH) console.log(`  ${deleted}/${ids.length} deleted`);
  }

  const after = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`\nDONE: ${deleted} deleted. Remaining: ${after.rows[0].c}`);

  await pg.query(
    `UPDATE "Lead" SET "recordType" = 'WEB' WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = $1 AND "recordType" != 'WEB'`,
    [WEB_LEAD_RT],
  );

  await pg.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
