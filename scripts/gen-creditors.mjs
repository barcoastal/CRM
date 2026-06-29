import fs from "node:fs";
const src = JSON.parse(fs.readFileSync("/Users/baralezrah/creditors-final.json", "utf8"));
const list = Array.isArray(src) ? src : src.result || src.list;
const header = `/**
 * Known creditor names, sourced from the Coastal Debt "Creditors List - Main"
 * sheet (creditor column only). Used as the typeahead source when adding a
 * debt. Users may still enter a creditor not on this list.
 *
 * ${list.length} entries. To refresh, re-run scripts/gen-creditors.mjs.
 */
export const KNOWN_CREDITORS: string[] = [
`;
const body = list.map((n) => "  " + JSON.stringify(n) + ",").join("\n");
fs.writeFileSync(
  "/Users/baralezrah/debt-settlement-app/src/lib/creditors.ts",
  header + body + "\n];\n"
);
console.log("wrote", list.length, "creditors to src/lib/creditors.ts");
