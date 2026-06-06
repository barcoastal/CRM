/**
 * Compare a single SF Opportunity row against what we have in CRM's sfDataJson.
 * Shows: fields in SF only, fields with different values, total counts.
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const SF_ID = process.argv[2] ?? "006VO00000ns08WYAQ"; // Kenya Palmer

async function main() {
  // 1) Discover all fields
  console.log("Discovering SF Opportunity fields…");
  const desc = spawnSync("sf", ["sobject", "describe", "--target-org", "coastal", "-s", "Opportunity", "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  if (desc.status !== 0) { console.error("describe failed"); process.exit(1); }
  type SfField = { name: string; type: string; nameField?: boolean };
  const allFields: SfField[] = JSON.parse(desc.stdout).result.fields;
  const queryable = allFields
    .filter((f) => f.type !== "address" && f.type !== "location" && f.name !== "Name")
    .map((f) => f.name);
  console.log(`SF has ${allFields.length} fields, ${queryable.length} queryable.`);

  // 2) Query SF in chunks (200-field limit per SOQL)
  const sfRow: Record<string, string> = {};
  const CHUNK = 100;
  for (let i = 0; i < queryable.length; i += CHUNK) {
    const fields = ["Id", "Name", ...queryable.slice(i, i + CHUNK)];
    const soql = `SELECT ${fields.join(",")} FROM Opportunity WHERE Id = '${SF_ID}'`;
    const res = spawnSync("sf", ["data", "query", "--target-org", "coastal", "-q", soql, "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (res.status !== 0) {
      console.error("query failed for chunk", i, res.stderr?.slice(0, 200));
      continue;
    }
    const parsed = JSON.parse(res.stdout) as { result?: { records?: Array<Record<string, unknown>> } };
    const rec = parsed.result?.records?.[0];
    if (!rec) continue;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "attributes") continue;
      if (v != null && v !== "") sfRow[k] = String(v);
    }
  }
  console.log(`SF Kenya Palmer has ${Object.keys(sfRow).length} populated fields.`);

  // 3) Pull CRM row
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`SELECT "sfDataJson" FROM "Opportunity" WHERE "sfId" = $1`, [SF_ID]);
  await pg.end();
  if (r.rows.length === 0) { console.log("Not in CRM"); return; }
  const crmJson = JSON.parse(r.rows[0].sfDataJson ?? "{}") as Record<string, string>;
  console.log(`CRM sfDataJson has ${Object.keys(crmJson).length} populated fields.`);

  // 4) Diff
  const sfKeys = new Set(Object.keys(sfRow));
  const crmKeys = new Set(Object.keys(crmJson));
  const missingInCrm: string[] = [];
  const differing: Array<{ k: string; sf: string; crm: string }> = [];

  for (const k of sfKeys) {
    if (!crmKeys.has(k)) {
      missingInCrm.push(k);
    } else if (sfRow[k] !== crmJson[k]) {
      differing.push({ k, sf: sfRow[k], crm: crmJson[k] });
    }
  }

  const extraInCrm = [...crmKeys].filter((k) => !sfKeys.has(k));

  console.log(`\n=== SUMMARY ===`);
  console.log(`SF populated: ${sfKeys.size}`);
  console.log(`CRM populated: ${crmKeys.size}`);
  console.log(`Missing in CRM (in SF but not in CRM): ${missingInCrm.length}`);
  console.log(`Extra in CRM (orphaned): ${extraInCrm.length}`);
  console.log(`Differing values: ${differing.length}`);

  if (missingInCrm.length > 0) {
    console.log(`\n=== MISSING IN CRM ===`);
    for (const k of missingInCrm.slice(0, 50)) {
      console.log(`  ${k} = ${sfRow[k].slice(0, 80)}`);
    }
    if (missingInCrm.length > 50) console.log(`  ... and ${missingInCrm.length - 50} more`);
  }

  if (differing.length > 0) {
    console.log(`\n=== DIFFERING VALUES (sample 20) ===`);
    for (const { k, sf, crm } of differing.slice(0, 20)) {
      console.log(`  ${k}`);
      console.log(`    SF:  ${sf.slice(0, 100)}`);
      console.log(`    CRM: ${crm.slice(0, 100)}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
