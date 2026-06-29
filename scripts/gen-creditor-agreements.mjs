import fs from "node:fs";

// Source: the "VLP" tab of the Coastal Debt creditor sheet (creditor column).
const SRC = process.env.VLP_JSON || "/Users/baralezrah/vlp-creditors.json";
const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const list = Array.isArray(raw) ? raw : raw.result || raw.list;

const header = `/**
 * Creditor -> agreement routing.
 *
 * Creditors on the "VLP" tab of the Coastal Debt creditor sheet receive the
 * VICTORY agreement; every other creditor receives CITADEL.
 *
 * Priority when a client owes several creditors: CITADEL wins. Victory is only
 * chosen when EVERY creditor on the file is a VLP creditor. (Confirmed by Bar.)
 *
 * ${list.length} VLP creditors. To refresh, re-run scripts/gen-creditor-agreements.mjs.
 */

export type Agreement = "Victory" | "Citadel";

export const VICTORY_CREDITORS: string[] = [
`;

const body = list.map((n) => "  " + JSON.stringify(n) + ",").join("\n");

const footer = `
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

const VICTORY_SET = new Set(VICTORY_CREDITORS.map(norm));

/** True if this exact creditor name is on the VLP (Victory) list. */
export function isVictoryCreditor(name: string | null | undefined): boolean {
  return !!name && VICTORY_SET.has(norm(name));
}

/**
 * Decide which agreement to send for a file, given the creditor names on it.
 * Victory only when there is at least one creditor and ALL are VLP creditors;
 * otherwise Citadel (the default, and the winner whenever the two mix).
 */
export function resolveAgreement(creditorNames: (string | null | undefined)[]): Agreement {
  const names = creditorNames.map((n) => (n ?? "").trim()).filter(Boolean);
  if (names.length > 0 && names.every((n) => isVictoryCreditor(n))) return "Victory";
  return "Citadel";
}
`;

fs.writeFileSync("src/lib/creditor-agreements.ts", header + body + footer);
console.log("wrote", list.length, "Victory creditors to src/lib/creditor-agreements.ts");
