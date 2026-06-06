import { Client } from 'pg';
async function m() {
  const p = new Client({ connectionString: process.env.DATABASE_URL });
  await p.connect();
  // get a random sample of 30 accounts with varying sfDataJson keys
  const r = await p.query('SELECT "sfId" FROM "Account" WHERE "sfDataJson" IS NOT NULL ORDER BY length("sfDataJson") DESC LIMIT 30 OFFSET 10');
  for (const x of r.rows) console.log(x.sfId);
  await p.end();
}
m();
