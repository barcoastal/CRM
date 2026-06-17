/** Dry run: print the mapped ListView definitions + warnings WITHOUT a DB. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type RawList, mapFilter, mapColumns, isOwnerFilter } from "../src/lib/sf-account-listview-map";

const data = JSON.parse(
  readFileSync(join(__dirname, "..", "docs", "sf-export", "account-listviews.json"), "utf8"),
) as { lists: RawList[] };

const warnings: string[] = [];
let withFilters = 0, withColumns = 0;

for (const list of data.lists) {
  if (list.developerName === "All_Accounts") continue;
  const filters = list.filters
    .map((rf) => mapFilter(rf, list.label, warnings))
    .filter(Boolean)
    .map((m) => (isOwnerFilter(m!) ? { field: "ownerId", op: "IN", value: `<resolve: ${m!.ownerNames.join(" | ")}>` } : m));
  const columns = mapColumns(list.columns, list.label, warnings);
  if (filters.length) withFilters++;
  if (columns.length) withColumns++;
  console.log(`\n● ${list.label}  (SF_${list.developerName})`);
  console.log(`  filters: ${JSON.stringify(filters)}`);
  console.log(`  columns: ${JSON.stringify(columns)}`);
}

console.log(`\n=== ${data.lists.length - 1} lists | ${withFilters} with filters | ${withColumns} with columns ===`);
console.log(`\n${warnings.length} warning(s):`);
for (const w of warnings) console.log(`  - ${w}`);
