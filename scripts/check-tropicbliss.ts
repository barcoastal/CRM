import { Client } from "pg";
import { spawnSync } from "node:child_process";
async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`SELECT "id","sfId","contactName","businessName","email","sfDataJson" FROM "Lead" WHERE "email" ILIKE 'amandadayca@gmail.com' OR "businessName" ILIKE 'Tropic Bliss' LIMIT 3`);
  for (const row of r.rows) {
    console.log("\n=== CRM Lead ===");
    console.log("  CRM id:", row.id);
    console.log("  sfId:", row.sfId);
    console.log("  contactName:", row.contactName);
    console.log("  businessName:", row.businessName);
    console.log("  email:", row.email);
    const j = JSON.parse(row.sfDataJson ?? "{}");
    console.log("  sfDataJson keys:", Object.keys(j).length);
    console.log("  FirstName in sfData:", j.FirstName ?? "<missing/empty>");
    console.log("  LastName in sfData:", j.LastName ?? "<missing/empty>");
    if (row.sfId) {
      console.log("\n  Querying SF directly for this Id…");
      const res = spawnSync(
        "sf",
        ["data", "query", "--target-org", "coastal", "-q", `SELECT Id, FirstName, LastName, Salutation, Company, Email FROM Lead WHERE Id = '${row.sfId}'`, "--result-format", "csv"],
        { encoding: "utf8" }
      );
      console.log("  SF says:");
      console.log(res.stdout);
    }
  }
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
