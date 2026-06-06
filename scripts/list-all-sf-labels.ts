import { spawnSync } from "node:child_process";
const desc = spawnSync("sf", ["sobject", "describe", "--target-org", "coastal", "-s", "Account", "--json"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
type SfField = { name: string; type: string; label: string };
const allFields: SfField[] = JSON.parse(desc.stdout).result.fields;
const search = process.argv.slice(2);
for (const f of allFields) {
  if (search.length === 0 || search.some((s) => f.label.toLowerCase().includes(s.toLowerCase()) || f.name.toLowerCase().includes(s.toLowerCase()))) {
    console.log(`  ${f.label}  |  ${f.name}`);
  }
}
