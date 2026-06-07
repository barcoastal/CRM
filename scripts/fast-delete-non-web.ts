/**
 * Fast bulk delete: keep only Web Lead recordtype, drop everything else.
 * Strategy: null all FK references in one shot per table, then DELETE in one shot.
 * No per-row batching.
 */
import { Client } from "pg";

const WEB_LEAD_RT = "012VO000002NUlrYAG";

async function safe(pg: Client, sql: string) {
  try {
    const r = await pg.query(sql);
    console.log("  OK", r.rowCount, "rows");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fail";
    if (msg.includes("does not exist")) {
      console.log("  skip (table absent)");
    } else {
      console.error("  FAIL", msg.slice(0, 150));
    }
  }
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("SET statement_timeout = 0");

  console.log("Before:");
  const before = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`  Leads with sfId: ${before.rows[0].c}`);

  // Single WHERE clause that identifies non-Web-Lead rows
  const W = `WHERE l."sfId" IS NOT NULL AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}'`;

  console.log("\n1. Nulling FK references on child tables…");
  await safe(pg, `UPDATE "Call" SET "leadId" = NULL FROM "Lead" l WHERE "Call"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "Task" SET "leadId" = NULL FROM "Lead" l WHERE "Task"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "Event" SET "leadId" = NULL FROM "Lead" l WHERE "Event"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "EmailMessage" SET "leadId" = NULL FROM "Lead" l WHERE "EmailMessage"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "SmsMessage" SET "leadId" = NULL FROM "Lead" l WHERE "SmsMessage"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "Opportunity" SET "leadId" = NULL FROM "Lead" l WHERE "Opportunity"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "Document" SET "leadId" = NULL FROM "Lead" l WHERE "Document"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `UPDATE "Envelope" SET "leadId" = NULL FROM "Lead" l WHERE "Envelope"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);

  console.log("\n2. Deleting strict-FK children…");
  await safe(pg, `DELETE FROM "LeadDebt" USING "Lead" l WHERE "LeadDebt"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `DELETE FROM "LeadPaymentCalculation" USING "Lead" l WHERE "LeadPaymentCalculation"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `DELETE FROM "LeadHistory" USING "Lead" l WHERE "LeadHistory"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);
  await safe(pg, `DELETE FROM "CampaignContact" USING "Lead" l WHERE "CampaignContact"."leadId" = l.id AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}' AND l."sfId" IS NOT NULL`);

  console.log("\n3. Deleting Lead rows…");
  await safe(pg, `DELETE FROM "Lead" AS l WHERE l."sfId" IS NOT NULL AND (l."sfDataJson"::jsonb ->> 'RecordTypeId') IS DISTINCT FROM '${WEB_LEAD_RT}'`);

  console.log("\n4. Marking surviving Web Leads with recordType = 'WEB'…");
  await safe(pg, `UPDATE "Lead" SET "recordType" = 'WEB' WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = '${WEB_LEAD_RT}' AND "recordType" != 'WEB'`);

  const after = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL`);
  console.log(`\nAfter: ${after.rows[0].c} Leads with sfId remain.`);

  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
