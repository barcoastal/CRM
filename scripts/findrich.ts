import { Client } from 'pg';
async function m() {
  const p = new Client({ connectionString: process.env.DATABASE_URL });
  await p.connect();
  const r = await p.query('SELECT "sfId", length("sfDataJson") AS len FROM "Account" WHERE "sfDataJson" IS NOT NULL ORDER BY length("sfDataJson") DESC LIMIT 10');
  for (const x of r.rows) console.log(x.sfId, x.len);
  await p.end();
}
m();
