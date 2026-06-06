/**
 * Fix the remaining "Unknown" rows by querying SF directly per-batch with
 * `sf data query --json`. JSON output avoids the CSV multi-line parse bug.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/fix-unknown-names.ts <lead|contact|account>
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const ENTITY = process.argv[2];
if (!ENTITY || !["lead", "contact", "account"].includes(ENTITY)) {
  console.error("Usage: tsx scripts/fix-unknown-names.ts <lead|contact|account>");
  process.exit(1);
}

const TABLE = ENTITY === "lead" ? "Lead" : ENTITY === "contact" ? "Contact" : "Account";
const SF_OBJECT = TABLE;
const NAME_COL = ENTITY === "lead" ? "contactName" : ENTITY === "contact" ? "fullName" : "name";

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const r = await pg.query(`SELECT "sfId" FROM "${TABLE}" WHERE "${NAME_COL}" = 'Unknown' OR "${NAME_COL}" IS NULL OR "${NAME_COL}" = ''`);
  const ids: string[] = r.rows.map((x: { sfId: string }) => x.sfId).filter(Boolean);
  console.log(`${ids.length} rows need fixing`);

  const BATCH = 200;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const inClause = batchIds.map((id) => `'${id}'`).join(",");
    const fields = ENTITY === "account"
      ? "Id, Name"
      : "Id, FirstName, LastName, Salutation";
    const soql = `SELECT ${fields} FROM ${SF_OBJECT} WHERE Id IN (${inClause})`;

    const res = spawnSync("sf", ["data", "query", "--target-org", "coastal", "-q", soql, "--json"], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    if (res.status !== 0) {
      console.error(`SF query failed at batch ${i}:`, res.stderr?.slice(0, 200));
      continue;
    }
    let records: Array<Record<string, string>> = [];
    try {
      const parsed = JSON.parse(res.stdout) as { result?: { records?: Array<Record<string, string>> } };
      records = parsed.result?.records ?? [];
    } catch {
      console.error(`JSON parse failed at batch ${i}`);
      continue;
    }

    if (records.length === 0) continue;

    // Build batched UPDATE via VALUES
    const placeholders: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const rec of records) {
      const id = rec.Id;
      let name = "";
      if (ENTITY === "account") {
        name = rec.Name ?? "";
      } else {
        const fn = rec.FirstName ?? "";
        const ln = rec.LastName ?? "";
        name = `${fn} ${ln}`.trim();
      }
      if (!name || !id) continue;
      placeholders.push(`($${p++}, $${p++})`);
      params.push(id, name);
    }
    if (placeholders.length === 0) continue;

    const sql = `
      UPDATE "${TABLE}" AS t
      SET "${NAME_COL}" = upd.n
      FROM (VALUES ${placeholders.join(",")}) AS upd(sf_id, n)
      WHERE t."sfId" = upd.sf_id AND (t."${NAME_COL}" = 'Unknown' OR t."${NAME_COL}" IS NULL)
    `;
    try {
      const u = await pg.query(sql, params);
      updated += u.rowCount ?? 0;
      if ((i / BATCH) % 10 === 0) console.log(`  ${updated} fixed, cursor ${i + batchIds.length}/${ids.length}`);
    } catch (e: unknown) {
      console.error(`  UPDATE failed at ${i}:`, e instanceof Error ? e.message : "fail");
    }
  }
  console.log(`DONE: ${updated} names fixed`);
  await pg.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
