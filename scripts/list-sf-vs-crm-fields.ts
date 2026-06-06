/**
 * For the Kenya Palmer opp:
 *   1. List every populated SF field (raw label + value)
 *   2. List every field rendered on CRM Opportunity Detail page
 *   3. Show: SF-only / CRM-only / both
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import fs from "node:fs";

const SF_ID = "006VO00000ns08WYAQ";

async function main() {
  // 1. SF populated fields
  const desc = spawnSync("sf", ["sobject", "describe", "--target-org", "coastal", "-s", "Opportunity", "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  type SfField = { name: string; type: string; label: string };
  const allFields: SfField[] = JSON.parse(desc.stdout).result.fields;
  const queryable = allFields.filter((f) => f.type !== "address" && f.type !== "location" && f.name !== "Name");

  const sfPopulated: Array<{ apiName: string; label: string }> = [];
  const CHUNK = 100;
  for (let i = 0; i < queryable.length; i += CHUNK) {
    const fields = ["Id", "Name", ...queryable.slice(i, i + CHUNK).map((f) => f.name)];
    const soql = `SELECT ${fields.join(",")} FROM Opportunity WHERE Id = '${SF_ID}'`;
    const res = spawnSync("sf", ["data", "query", "--target-org", "coastal", "-q", soql, "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (res.status !== 0) continue;
    const rec = (JSON.parse(res.stdout) as { result?: { records?: Array<Record<string, unknown>> } }).result?.records?.[0];
    if (!rec) continue;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "attributes" || v == null || v === "") continue;
      const meta = allFields.find((f) => f.name === k);
      if (sfPopulated.some(s => s.apiName === k)) continue;
      sfPopulated.push({ apiName: k, label: meta?.label ?? k });
    }
  }
  console.log(`\n=== SF Kenya Palmer populated fields (${sfPopulated.length}) ===`);
  for (const f of sfPopulated.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(`  ${f.label.padEnd(45)} (${f.apiName})`);
  }

  // 2. Extract field labels rendered on CRM Opp detail page
  const oppPage = fs.readFileSync("/Users/baralezrah/debt-settlement-app/src/app/(dashboard)/opportunities/[id]/page.tsx", "utf8");
  // FieldGrid takes [["Label", value], ...]. Grep all labels.
  const labelRegex = /\["([^"]+)"\s*,/g;
  const crmLabels = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = labelRegex.exec(oppPage)) !== null) {
    if (m[1] && m[1].length > 1 && m[1].length < 80) crmLabels.add(m[1]);
  }
  console.log(`\n=== CRM Opp Detail rendered labels (${crmLabels.size}) ===`);
  for (const l of [...crmLabels].sort()) console.log(`  ${l}`);

  // 3. Diff by label
  const sfLabelSet = new Set(sfPopulated.map(s => s.label));
  const onlySf = sfPopulated.filter(s => !crmLabels.has(s.label));
  const onlyCrm = [...crmLabels].filter(l => !sfLabelSet.has(l));
  console.log(`\n=== SF-ONLY (visible in SF, NOT in CRM, ${onlySf.length}) ===`);
  for (const f of onlySf.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(`  ${f.label.padEnd(45)} (${f.apiName})`);
  }
  console.log(`\n=== CRM-ONLY (in CRM, NOT in SF, ${onlyCrm.length}) ===`);
  for (const l of onlyCrm.sort()) console.log(`  ${l}`);
}
main().catch(e => { console.error(e); process.exit(1); });
