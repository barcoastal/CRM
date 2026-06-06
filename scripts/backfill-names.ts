/**
 * Backfill FirstName/LastName on Lead (and Contact) for rows whose contactName/fullName === "Unknown".
 * Earlier migration filtered FirstName/LastName as compound-Name parts so they
 * were never captured. We pull ALL records from SF (one bulk export per entity)
 * and update by sfId.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/backfill-names.ts <lead|contact>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";
import { Client } from "pg";

const ENTITY = process.argv[2];
if (!ENTITY || !["lead", "contact"].includes(ENTITY)) {
  console.error("Usage: tsx scripts/backfill-names.ts <lead|contact>");
  process.exit(1);
}

const SF_OBJECT = ENTITY === "lead" ? "Lead" : "Contact";
const TABLE = SF_OBJECT;
const CSV = `/tmp/sf-${ENTITY}-names.csv`;

async function main() {
  if (!fs.existsSync(CSV) || fs.statSync(CSV).size < 100) {
    console.log(`[${new Date().toISOString()}] Exporting names from SF (bulk)…`);
    const r = spawnSync(
      "sf",
      [
        "data", "export", "bulk",
        "--target-org", "coastal",
        "--query", `SELECT Id, FirstName, LastName, Salutation FROM ${SF_OBJECT}`,
        "--result-format", "csv",
        "--output-file", CSV,
        "--wait", "240",
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      console.error("Bulk export failed");
      process.exit(1);
    }
  } else {
    console.log(`[reuse] ${CSV}: ${(fs.statSync(CSV).size / 1024 / 1024).toFixed(1)} MB`);
  }

  console.log(`[${new Date().toISOString()}] Loading names from CSV…`);
  const namesMap = new Map<string, { fn: string; ln: string; sal: string }>();
  const stream = fs.createReadStream(CSV);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers: string[] | null = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    if (!headers) { headers = cells; continue; }
    const id = cells[headers.indexOf("Id")];
    const fn = cells[headers.indexOf("FirstName")] ?? "";
    const ln = cells[headers.indexOf("LastName")] ?? "";
    const sal = cells[headers.indexOf("Salutation")] ?? "";
    if (id) namesMap.set(id, { fn, ln, sal });
  }
  console.log(`  ${namesMap.size} names available`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  console.log(`[${new Date().toISOString()}] Updating ${TABLE} by sfId…`);
  let updated = 0;
  const sfIds = Array.from(namesMap.keys());
  const BATCH = 1000;
  for (let i = 0; i < sfIds.length; i += BATCH) {
    const batch = sfIds.slice(i, i + BATCH);
    const placeholders: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const id of batch) {
      const n = namesMap.get(id)!;
      const contactName = `${n.fn} ${n.ln}`.trim() || "Unknown";
      placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(id, n.fn || null, n.ln || null, contactName);
    }
    const setSql = ENTITY === "lead"
      ? `"contactName" = upd.contact_name, "firstName" = upd.fn, "lastName" = upd.ln`
      : `"fullName" = upd.contact_name, "firstName" = upd.fn, "lastName" = upd.ln`;
    const sql = `
      UPDATE "${TABLE}" AS l
      SET ${setSql}
      FROM (VALUES ${placeholders.join(",")}) AS upd(sf_id, fn, ln, contact_name)
      WHERE l."sfId" = upd.sf_id
    `;
    try {
      const res = await pg.query(sql, params);
      updated += res.rowCount ?? 0;
      if (updated % 10000 < BATCH) console.log(`  ${updated} rows updated (cursor at ${i + batch.length}/${sfIds.length})`);
    } catch (e: unknown) {
      console.error(`  update fail at ${i}:`, e instanceof Error ? e.message : "fail");
    }
  }
  console.log(`[${new Date().toISOString()}] DONE: ${updated} updated`);
  await pg.end();
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === ",") { out.push(cur); cur = ""; }
    else if (c === '"') inQuotes = true;
    else cur += c;
  }
  out.push(cur);
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
