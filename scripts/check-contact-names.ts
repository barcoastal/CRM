import { Client } from "pg";
async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const total = await pg.query(`SELECT COUNT(*)::int AS c FROM "Contact" WHERE "sfId" IS NOT NULL`);
  const unknown = await pg.query(`SELECT COUNT(*)::int AS c FROM "Contact" WHERE "fullName" = 'Unknown' AND "sfId" IS NOT NULL`);
  const sampleNamed = await pg.query(`SELECT "fullName", "firstName", "lastName", "sfId", "email" FROM "Contact" WHERE "fullName" != 'Unknown' AND "sfId" IS NOT NULL LIMIT 5`);
  const sampleUnknown = await pg.query(`SELECT "fullName", "firstName", "lastName", "sfId", "email", "sfDataJson" FROM "Contact" WHERE "fullName" = 'Unknown' AND "sfId" IS NOT NULL LIMIT 3`);
  console.log("Total contacts with sfId:", total.rows[0].c);
  console.log("Unknown fullName:", unknown.rows[0].c);
  console.log("\n5 with names:");
  for (const r of sampleNamed.rows) console.log(" ", r.sfId, "|", r.fullName, "|", r.email);
  console.log("\n3 Unknown sample:");
  for (const r of sampleUnknown.rows) {
    const j = JSON.parse(r.sfDataJson ?? "{}");
    console.log(" ", r.sfId, "fn:", j.FirstName, "ln:", j.LastName, "email:", r.email);
  }
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
