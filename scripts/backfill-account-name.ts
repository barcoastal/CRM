/**
 * Many CRM accounts have name = "Unnamed Account" (migration default when SF
 * Name was empty). The real SF name lives in the migrated sfDataJson under
 * "Name". Re-pull it from sfDataJson and update the typed column.
 */
import { Client } from "pg";

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  // Strategy: use Primary_Contact_Name__c since SF "Name" was filtered out
  // during migration as a compound field. For Person Accounts this matches the
  // SF UI display name (e.g. "Kenya Palmer").
  const r1 = await pg.query(`
    UPDATE "Account"
    SET "name" = "sfDataJson"::jsonb ->> 'Primary_Contact_Name__c'
    WHERE "name" = 'Unnamed Account'
      AND "sfDataJson" IS NOT NULL
      AND ("sfDataJson"::jsonb ->> 'Primary_Contact_Name__c') IS NOT NULL
      AND ("sfDataJson"::jsonb ->> 'Primary_Contact_Name__c') != ''
    RETURNING id
  `);
  console.log(`From Primary_Contact_Name__c: ${r1.rowCount} accounts updated.`);

  // Fallback: try plain Name (rare — most were filtered out)
  const r2 = await pg.query(`
    UPDATE "Account"
    SET "name" = "sfDataJson"::jsonb ->> 'Name'
    WHERE "name" = 'Unnamed Account'
      AND "sfDataJson" IS NOT NULL
      AND ("sfDataJson"::jsonb ->> 'Name') IS NOT NULL
      AND ("sfDataJson"::jsonb ->> 'Name') != ''
    RETURNING id
  `);
  console.log(`From Name: ${r2.rowCount} accounts updated.`);

  const left = await pg.query(`SELECT COUNT(*)::int AS c FROM "Account" WHERE "name" = 'Unnamed Account'`);
  console.log(`Still 'Unnamed Account': ${left.rows[0].c}`);
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
