import { Client } from "pg";
async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`SELECT "sfId","contactName","sfDataJson" FROM "Lead" WHERE "sfDataJson"::jsonb ? 'Total_Debt_Amount__c' OR "sfDataJson"::jsonb ? 'Ad_Click_Id__c' LIMIT 1`);
  if (r.rows.length === 0) {
    console.log("NO leads have Total_Debt_Amount__c or Ad_Click_Id__c populated.");
  } else {
    const row = r.rows[0];
    const json = JSON.parse(row.sfDataJson);
    console.log("sfId:", row.sfId, "contactName:", row.contactName);
    console.log("Total keys:", Object.keys(json).length);
    console.log("Total_Debt_Amount__c:", json.Total_Debt_Amount__c);
    console.log("Ad_Click_Id__c:", json.Ad_Click_Id__c);
    for (const k of Object.keys(json).filter(k => k.endsWith("__c")).slice(0,30)) {
      console.log("  " + k + " = " + String(json[k] ?? "").slice(0,40));
    }
  }
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
