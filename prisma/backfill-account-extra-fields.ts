/**
 * Phase 3 — load the targeted SF pull (docs/sf-export/account-extra-fields.csv)
 * into the CRM by matching SF Id -> Account.sfId. Fields not present in the
 * sfDataJson snapshot: netProfit, externalSasId, externalRamId, feePaidInFull
 * (live SF has 476 true; snapshot was stale), programCompletionStage.
 *
 *   DATABASE_URL=... npx tsx prisma/backfill-account-extra-fields.ts
 *
 * Stages rows in a table then runs set-based UPDATE FROM joins (idempotent).
 *
 * Regenerate the CSV (kept local, like sfdx-raw — not committed):
 *   sf data query --target-org coastal --result-format csv \
 *     --query "SELECT Id, Net_Profit__c, External_SAS_Id__c, External_RAM_Id__c, \
 *       Fee_Paid_In_Full__c, Program_Completion_Stage__c FROM Account \
 *       WHERE Net_Profit__c != null OR External_SAS_Id__c != null OR \
 *       External_RAM_Id__c != null OR Fee_Paid_In_Full__c = true OR \
 *       Program_Completion_Stage__c = true" > docs/sf-export/account-extra-fields.csv
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

/** Minimal RFC4180 CSV parser. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

async function main() {
  const text = readFileSync(join(__dirname, "..", "docs", "sf-export", "account-extra-fields.csv"), "utf8");
  const rows = parseCsv(text);
  const header = rows.shift()!;
  console.log(`Loaded ${rows.length} rows. Columns: ${header.join(", ")}\n`);

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _sf_extra;`);
  await prisma.$executeRawUnsafe(`CREATE TABLE _sf_extra (sfid text PRIMARY KEY, np double precision, sas text, ram text, fee boolean, pcs boolean);`);

  // stage rows in chunks
  const norm = (s: string) => (s == null || s.trim() === "" ? null : s.trim());
  const numv = (s: string) => { const v = norm(s); if (v == null) return null; const n = Number(v.replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
  const boolv = (s: string) => /^true$/i.test((s || "").trim());

  let staged = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => {
      const sfid = norm(r[0]); if (!sfid) return null;
      const np = numv(r[1]); const sas = norm(r[2]); const ram = norm(r[3]);
      const fee = boolv(r[4]); const pcs = boolv(r[5]);
      const q = (v: string | null) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
      return `('${sfid.replace(/'/g, "''")}', ${np == null ? "NULL" : np}, ${q(sas)}, ${q(ram)}, ${fee}, ${pcs})`;
    }).filter(Boolean);
    if (values.length) {
      await prisma.$executeRawUnsafe(`INSERT INTO _sf_extra (sfid, np, sas, ram, fee, pcs) VALUES ${values.join(",")} ON CONFLICT (sfid) DO NOTHING;`);
      staged += values.length;
    }
  }
  console.log(`Staged ${staged} rows.\n`);

  const run = async (label: string, sql: string) => {
    const n = (await prisma.$executeRawUnsafe(sql)) as unknown as number;
    console.log(`✓ ${label}: ${n} rows updated`);
  };
  await run("netProfit", `UPDATE "Account" a SET "netProfit" = s.np FROM _sf_extra s WHERE a."sfId" = s.sfid AND s.np IS NOT NULL AND a."netProfit" IS DISTINCT FROM s.np;`);
  await run("externalSasId", `UPDATE "Account" a SET "externalSasId" = s.sas FROM _sf_extra s WHERE a."sfId" = s.sfid AND s.sas IS NOT NULL AND a."externalSasId" IS DISTINCT FROM s.sas;`);
  await run("externalRamId", `UPDATE "Account" a SET "externalRamId" = s.ram FROM _sf_extra s WHERE a."sfId" = s.sfid AND s.ram IS NOT NULL AND a."externalRamId" IS DISTINCT FROM s.ram;`);
  await run("feePaidInFull", `UPDATE "Account" a SET "feePaidInFull" = s.fee FROM _sf_extra s WHERE a."sfId" = s.sfid AND a."feePaidInFull" IS DISTINCT FROM s.fee;`);
  await run("programCompletionStage", `UPDATE "Account" a SET "programCompletionStage" = s.pcs FROM _sf_extra s WHERE a."sfId" = s.sfid AND a."programCompletionStage" IS DISTINCT FROM s.pcs;`);

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _sf_extra;`);
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
