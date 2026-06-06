/**
 * Generalized: list SF populated fields vs CRM rendered labels for any entity.
 * Usage: tsx list-sf-vs-crm-fields-v2.ts <opportunity|lead|account|contact> <sfId>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const ENT = process.argv[2];
const SF_ID = process.argv[3];
const MAP: Record<string, { sf: string; path: string }> = {
  opportunity: { sf: "Opportunity", path: "src/app/(dashboard)/opportunities/[id]/page.tsx" },
  lead: { sf: "Lead", path: "src/app/(dashboard)/leads/[id]/page.tsx" },
  account: { sf: "Account", path: "src/app/(dashboard)/accounts/[id]/page.tsx" },
  contact: { sf: "Contact", path: "src/app/(dashboard)/contacts/[id]/page.tsx" },
};
const cfg = MAP[ENT];
if (!cfg || !SF_ID) { console.error("Usage: tsx list-sf-vs-crm-fields-v2.ts <opportunity|lead|account|contact> <sfId>"); process.exit(1); }

async function main() {
  const desc = spawnSync("sf", ["sobject", "describe", "--target-org", "coastal", "-s", cfg.sf, "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  type SfField = { name: string; type: string; label: string };
  const allFields: SfField[] = JSON.parse(desc.stdout).result.fields;
  const queryable = allFields.filter((f) => f.type !== "address" && f.type !== "location" && f.name !== "Name");

  const sfPopulated: Array<{ apiName: string; label: string; value: string }> = [];
  const CHUNK = 100;
  for (let i = 0; i < queryable.length; i += CHUNK) {
    const fields = ["Id", "Name", ...queryable.slice(i, i + CHUNK).map((f) => f.name)];
    const soql = `SELECT ${fields.join(",")} FROM ${cfg.sf} WHERE Id = '${SF_ID}'`;
    const res = spawnSync("sf", ["data", "query", "--target-org", "coastal", "-q", soql, "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (res.status !== 0) continue;
    const rec = (JSON.parse(res.stdout) as { result?: { records?: Array<Record<string, unknown>> } }).result?.records?.[0];
    if (!rec) continue;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "attributes" || v == null || v === "") continue;
      if (sfPopulated.some(s => s.apiName === k)) continue;
      const meta = allFields.find((f) => f.name === k);
      sfPopulated.push({ apiName: k, label: meta?.label ?? k, value: String(v).slice(0, 60) });
    }
  }

  const page = fs.readFileSync(cfg.path, "utf8");
  const labelRegex = /\["([^"]+)"\s*,/g;
  const crmLabels = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = labelRegex.exec(page)) !== null) {
    if (m[1] && m[1].length > 1 && m[1].length < 80) crmLabels.add(m[1]);
  }

  const sfLabelSet = new Set(sfPopulated.map(s => s.label));
  const onlySf = sfPopulated.filter(s => !crmLabels.has(s.label));

  console.log(`\n# ${cfg.sf} ${SF_ID}`);
  console.log(`SF populated: ${sfPopulated.length}  CRM rendered: ${crmLabels.size}`);
  console.log(`\n=== MISSING IN CRM (${onlySf.length}) — add these with exact SF label ===`);
  for (const f of onlySf.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(`  "${f.label}"  (sfDataJson.${f.apiName}) = ${f.value}`);
  }
  console.log(`\n=== CRM-ONLY labels (${crmLabels.size - sfLabelSet.size}, may be renames) ===`);
  for (const l of [...crmLabels].filter(l => !sfLabelSet.has(l)).sort()) console.log(`  "${l}"`);
}
main().catch(e => { console.error(e); process.exit(1); });
