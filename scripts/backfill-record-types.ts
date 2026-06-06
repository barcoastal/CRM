/**
 * Map SF RecordTypeId from sfDataJson onto Lead.recordType so the lists
 * can be filtered by Web Lead / List Lead (purchased) / Direct Mail / etc.
 */
import { Client } from "pg";

const LEAD_RT_MAP: Record<string, string> = {
  "012VO000002NUlrYAG": "WEB",                  // Web Lead
  "012VO000002NUlqYAG": "LIST",                 // List Lead (purchased)
  "012VO000002VGc1YAG": "DIRECT_MAIL",          // Direct Mail Lead
  "0128Y000001Z0JTQA0": "BUSINESS",             // Business
  "0128Y000001Z0JUQA0": "BUSINESS",             // Consumer (treat as business for now)
  "012VO000000ceNpYAI": "WEB",                  // Pre Lead → WEB
  "012VO000002NUlpYAG": "WEB",                  // Pre Lead (duplicate id from output)
  "012VO000002NUloYAG": "ARCHIVED_WEB",         // Archived Lead (generic)
  "012VO000002VDizYAG": "ARCHIVED_WEB",         // Archived Web Lead
  "012VO000002VDmDYAW": "ARCHIVED_LIST",        // Archived List Lead
  "012VO000002VGk5YAG": "ARCHIVED_DIRECT_MAIL", // Archived Direct Mail Lead
  "012VO000002NUlpYAG_archived": "ARCHIVED_WEB",
};

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const totals: Record<string, number> = {};
  for (const [sfRtId, ourRt] of Object.entries(LEAD_RT_MAP)) {
    if (sfRtId.includes("_archived")) continue;
    console.log(`Updating ${ourRt} (sfRecordType=${sfRtId})…`);
    const r = await pg.query(
      `UPDATE "Lead" SET "recordType" = $1 WHERE "sfDataJson"::jsonb ->> 'RecordTypeId' = $2 AND "recordType" != $1`,
      [ourRt, sfRtId],
    );
    totals[ourRt] = (totals[ourRt] ?? 0) + (r.rowCount ?? 0);
    console.log(`  ${r.rowCount} updated`);
  }

  console.log("\n=== TOTALS ===");
  for (const [rt, n] of Object.entries(totals)) console.log(`  ${rt}: ${n}`);

  const dist = await pg.query(`SELECT "recordType", COUNT(*)::int AS c FROM "Lead" WHERE "sfId" IS NOT NULL GROUP BY "recordType" ORDER BY c DESC`);
  console.log("\n=== FINAL CRM Lead recordType distribution ===");
  for (const row of dist.rows) console.log("  ", row.recordType, "=", row.c);

  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
