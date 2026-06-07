/**
 * Snapshot + TRUNCATE + restore: the fastest way to keep ~15K Web Leads while
 * dropping the other ~5.11M.
 *
 *   1. Copy the ~15K keepers to "Lead_keep"
 *   2. Null all leadId on tables that allow it
 *   3. Delete strict-FK children that reference non-keeper leads
 *   4. TRUNCATE "Lead"
 *   5. INSERT keepers back
 *   6. DROP "Lead_keep"
 */
import { Client } from "pg";

const WEB_LEAD_RT = "012VO000002NUlrYAG";

async function safe(pg: Client, label: string, sql: string) {
  try {
    const r = await pg.query(sql);
    console.log(`  ${label}: ${r.rowCount ?? 0}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fail";
    if (msg.includes("does not exist") || msg.includes("does not have column")) {
      console.log(`  ${label}: skip`);
    } else {
      console.error(`  ${label}: ${msg.slice(0, 200)}`);
    }
  }
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("SET statement_timeout = 0");

  const start = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead"`);
  console.log(`Start: ${start.rows[0].c} total Lead rows`);
  const keepCount = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead" WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = $1`, [WEB_LEAD_RT]);
  console.log(`  of which Web Lead recordtype: ${keepCount.rows[0].c}`);

  console.log("\n1. Snapshot the keepers to Lead_keep…");
  await safe(pg, "drop old snapshot", `DROP TABLE IF EXISTS "Lead_keep"`);
  await safe(pg, "snapshot", `CREATE TABLE "Lead_keep" AS SELECT * FROM "Lead" WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = '${WEB_LEAD_RT}'`);

  console.log("\n2. NULL out FKs on tables that allow null…");
  await safe(pg, "Call.leadId", `UPDATE "Call" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "Task.leadId", `UPDATE "Task" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "Event.leadId", `UPDATE "Event" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "EmailMessage.leadId", `UPDATE "EmailMessage" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "SmsMessage.leadId", `UPDATE "SmsMessage" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "Opportunity.leadId", `UPDATE "Opportunity" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "Document.leadId", `UPDATE "Document" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "Envelope.leadId", `UPDATE "Envelope" SET "leadId" = NULL WHERE "leadId" IS NOT NULL AND "leadId" NOT IN (SELECT id FROM "Lead_keep")`);

  console.log("\n3. Delete strict-FK children of non-keeper leads…");
  await safe(pg, "LeadDebt", `DELETE FROM "LeadDebt" WHERE "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "LeadPaymentCalculation", `DELETE FROM "LeadPaymentCalculation" WHERE "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "LeadHistory", `DELETE FROM "LeadHistory" WHERE "leadId" NOT IN (SELECT id FROM "Lead_keep")`);
  await safe(pg, "CampaignContact", `DELETE FROM "CampaignContact" WHERE "leadId" NOT IN (SELECT id FROM "Lead_keep")`);

  console.log("\n4. TRUNCATE Lead…");
  await safe(pg, "TRUNCATE", `TRUNCATE "Lead"`);

  console.log("\n5. Restore keepers…");
  await safe(pg, "INSERT keepers back", `INSERT INTO "Lead" SELECT * FROM "Lead_keep"`);

  console.log("\n6. Tag recordType + drop snapshot…");
  await safe(pg, "tag recordType", `UPDATE "Lead" SET "recordType" = 'WEB' WHERE "recordType" != 'WEB'`);
  await safe(pg, "drop snapshot", `DROP TABLE "Lead_keep"`);

  const end = await pg.query(`SELECT COUNT(*)::int AS c FROM "Lead"`);
  console.log(`\nEnd: ${end.rows[0].c} Lead rows`);
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
