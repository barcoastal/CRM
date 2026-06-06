import { Client } from "pg";
async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`SELECT id, "sfId", name, stage, "sfDataJson" FROM "Opportunity" WHERE "sfId" = '006VO00000ns08WYAQ' OR name ILIKE 'Kenya Palmer'`);
  if (r.rows.length === 0) {
    console.log("NOT FOUND in CRM");
    return;
  }
  for (const row of r.rows) {
    console.log("CRM id:", row.id);
    console.log("sfId:", row.sfId);
    console.log("name:", row.name);
    console.log("stage:", row.stage);
    const j = JSON.parse(row.sfDataJson ?? "{}");
    console.log("sfDataJson keys:", Object.keys(j).length);
    console.log("First 30 populated keys:");
    for (const k of Object.keys(j).slice(0, 30)) {
      console.log("  ", k, "=", String(j[k]).slice(0, 60));
    }
  }
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
