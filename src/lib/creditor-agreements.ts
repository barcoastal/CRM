/**
 * Creditor -> agreement routing.
 *
 * Creditors on the "VLP" tab of the Coastal Debt creditor sheet receive the
 * VICTORY agreement; every other creditor receives CITADEL.
 *
 * Priority when a client owes several creditors: CITADEL wins. Victory is only
 * chosen when EVERY creditor on the file is a VLP creditor. (Confirmed by Bar.)
 *
 * 112 VLP creditors. To refresh, re-run scripts/gen-creditor-agreements.mjs.
 */

export type Agreement = "Victory" | "Citadel";

export const VICTORY_CREDITORS: string[] = [
  "Lendr",
  "Ondeck",
  "QS Capital Partners",
  "Quicksilver Capital",
  "White Road",
  "Olympus",
  "Arsenal",
  "Coconut Funding",
  "Emerald group holdings",
  "Flexibility Capital",
  "Forever Funding",
  "Fortress Merchant Solutions",
  "Milestone",
  "MNS Funding",
  "QFS",
  "Skyinance",
  "Sound Advance",
  "Star Advance",
  "Velocity",
  "VitalCap Fund",
  "Wells Advance",
  "Xpress Capital",
  "Ace Funding",
  "Alternative Funding",
  "Amsterdam Capital Solutions",
  "Arsenal Funding",
  "Avanza Capital",
  "BizFund LLC",
  "Blade Funding",
  "Bow Apple Capital",
  "Broadway",
  "ByzFunder",
  "Capytal.com",
  "Cashable",
  "Cashfloit",
  "CFG",
  "Clearfund Solutions, LLC",
  "Diesel funding",
  "Diverse Capital",
  "E Advance Services",
  "Eagle Eye",
  "Emmy Capital",
  "Essential",
  "Fenix Capital (CHANGE BANKS !)",
  "Fintap",
  "Fratello",
  "Fundamental Capital",
  "Fusion Funding",
  "GCM Capital",
  "GFE",
  "Globex Funding",
  "Global Merchant Cash",
  "GMC Funding",
  "Green Note Capital",
  "Highland Hill",
  "iFund Co",
  "In Advance",
  "Kalamata Capital Group, LLC",
  "LCF / Last Chance Funding",
  "Mantis",
  "Mint Funding",
  "Merk Funding",
  "NewCo Capital",
  "Overton Funding",
  "Pac Western",
  "Parkview",
  "Parkside",
  "Pinnacle Lending",
  "Purple Tree Funding",
  "RDM Capital Funding",
  "River Advance",
  "Roc Funding",
  "Rocket capital",
  "Samson",
  "Seamless Capital",
  "Silverline",
  "Simply Funding",
  "Smart Business Funding",
  "Smart Funding Capital",
  "Sofia Grey LLC",
  "Specialty Capital",
  "Swift Funding Source",
  "The Smarter Merchant",
  "Torro",
  "United First",
  "Vault Cap, LLC",
  "Vivian Capital",
  "Vox Funding",
  "Wellen Capital",
  "Westwood",
  "Yes Capital Group",
  "KRS Partners",
  "VIBRANT FUNDING LLC",
  "SLATE ADVANCE",
  "Barclays Advance",
  "Lazarus Capital",
  "BIG Blackbridge Investment Group",
  "Sinclair",
  "IMS FUND LLC",
  "Woodmere Fincancial",
  "Novus",
  "eFinancial Tree",
  "GCap Holdings LLC",
  "LAG Holdings",
  "Millstone",
  "Paladin Funding Group",
  "Symplifi",
  "Invictus Partners LLC",
  "SunBiz Funding",
  "JRG",
  "Funding Future",
  "Bridge Funding Cap",
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
