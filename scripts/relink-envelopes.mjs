import pg from "pg";
import { readFileSync } from "fs";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === '\r') continue;
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const headers = rows[0];
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, j) => [h, r[j] ?? ""])));
}

const rows = parseCSV(readFileSync("/tmp/sf-envelopes/all-envelope-statuses.csv", "utf-8"));
console.log(`Parsed ${rows.length} envelopes from CSV`);

// Preload SF Opp ID maps for fast lookup
console.log("Preloading Opportunity SF ID maps...");
const oppMap = new Map();
const all = await c.query(`
  SELECT id, "sfId", ("sfDataJson"::jsonb) ->> 'Id' AS sf_data_id
  FROM "Opportunity"
`);
for (const row of all.rows) {
  if (row.sfId && row.sfId.length > 5) oppMap.set(row.sfId, row.id);
  if (row.sf_data_id) oppMap.set(row.sf_data_id, row.id);
}
console.log(`  Opp map size: ${oppMap.size}`);

// Also account map
const acctMap = new Map();
const acc = await c.query(`SELECT id, "sfId" FROM "Account" WHERE "sfId" IS NOT NULL`);
for (const row of acc.rows) acctMap.set(row.sfId, row.id);
console.log(`  Account map size: ${acctMap.size}`);

let linked_opp = 0, linked_acct = 0, no_link = 0;
let i = 0;
for (const r of rows) {
  i++;
  const sfId = r["Id"];
  const sfOppId = r["dfsle__Opportunity__c"];
  const sfAcctId = r["dfsle__Account__c"];
  let oppId = sfOppId ? oppMap.get(sfOppId) : null;
  let accountId = sfAcctId ? acctMap.get(sfAcctId) : null;
  // If no direct account link, derive from Opp -> Account
  if (oppId && !accountId) {
    const o = await c.query(`SELECT "accountId" FROM "Opportunity" WHERE id = $1`, [oppId]);
    if (o.rows[0]?.accountId) accountId = o.rows[0].accountId;
  }
  if (!oppId && !accountId) { no_link++; continue; }
  await c.query(`
    UPDATE "Envelope" SET "opportunityId" = $1, "accountId" = $2, "updatedAt" = NOW()
    WHERE id = $3
  `, [oppId, accountId, 'env_sf_' + sfId.slice(0, 24)]);
  if (oppId) linked_opp++;
  if (accountId) linked_acct++;
  if (i % 1000 === 0) console.log(`  ... ${i}/${rows.length} processed, linked: opp=${linked_opp} acct=${linked_acct}`);
}

console.log(`\nDone:`);
console.log(`  Linked to Opp:     ${linked_opp}`);
console.log(`  Linked to Account: ${linked_acct}`);
console.log(`  No link:           ${no_link}`);

const final = await c.query(`
  SELECT
    COUNT(*) FILTER (WHERE "opportunityId" IS NOT NULL) AS with_opp,
    COUNT(*) FILTER (WHERE "accountId" IS NOT NULL) AS with_acct,
    COUNT(*) AS total
  FROM "Envelope" WHERE id LIKE 'env_sf_%'
`);
console.log("\nFinal envelope coverage:", final.rows[0]);

await c.end();
