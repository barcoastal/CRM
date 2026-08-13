/**
 * Lender intelligence, transcribed 2026-08-13 from Bar's lender sheet
 * (Google Sheet "Creditors" tab screenshots). Shown to agents next to the
 * creditor picker when adding a debt, and inside the contract-analysis
 * drawer.
 *
 * lienRiskLevel: 1 = works with us / low aggression (VLP tier),
 *                2 = medium, 3 = aggressive.
 * coj / tro: the sheet's COJ / TRO columns (contract contains it or they
 * use it). venue: where they sue. notes: verbatim agent guidance.
 */

export interface LenderIntel {
  name: string;
  aka?: string;
  plaidFinicity?: boolean;
  lienRiskLevel?: 1 | 2 | 3;
  coj?: boolean;
  tro?: boolean;
  venue?: string;
  notes?: string;
}

export const LENDER_INTEL: LenderIntel[] = [
  { name: "Lendr", lienRiskLevel: 1, venue: "NY" },
  { name: "Ondeck", aka: "ODK Capital", plaidFinicity: true, lienRiskLevel: 1, venue: "UT unless client is in CA", notes: "Reports on credit (actual loan, not an MCA). Could turn over to recovery group who can lien receivables and will also sue. Send to Aubrey Thrasher (attorney), but requires true hardship." },
  { name: "QS Capital Partners", lienRiskLevel: 1, venue: "NY" },
  { name: "Quicksilver Capital", aka: "QS Capital Partners", lienRiskLevel: 1, venue: "NY" },
  { name: "White Road", aka: "GFE whitelabel", lienRiskLevel: 1, venue: "NY" },
  { name: "Olympus", aka: "Olympus Business Capital", lienRiskLevel: 1, venue: "NY", notes: "Sues out of New York." },
  { name: "Arsenal", lienRiskLevel: 1, venue: "NY", notes: "Just usually lawsuits, not liens." },
  { name: "Coconut Funding", lienRiskLevel: 1, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Emerald group holdings", aka: "Vital Cap Fund", lienRiskLevel: 1, venue: "NY", notes: "Will file suit in NY, use attorney Richard Muller." },
  { name: "Flexibility Capital", lienRiskLevel: 1, venue: "NY" },
  { name: "Forever Funding", lienRiskLevel: 1, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Fortress Merchant Solutions", lienRiskLevel: 1, venue: "NY" },
  { name: "Milestone", lienRiskLevel: 1, venue: "NY", notes: "Will file a lawsuit." },
  { name: "MNS Funding", lienRiskLevel: 1, venue: "NY", notes: "We have good relations - 50 cent settlements - do reverse consolidations." },
  { name: "QFS", aka: "Quality Funding Solutions", lienRiskLevel: 1, venue: "NY", notes: "Uses Law Office of Isaac Greenfield." },
  { name: "Skyinance", lienRiskLevel: 1, venue: "NY", notes: "Uses Triton Recovery and has TRO in agreement.", tro: true },
  { name: "Sound Advance", lienRiskLevel: 1, tro: true, venue: "NY" },
  { name: "Star Advance", lienRiskLevel: 1, coj: true, venue: "NY", notes: "Has COJ and has liened." },
  { name: "Velocity", lienRiskLevel: 1, venue: "NY", notes: "Will file a lawsuit." },
  { name: "VitalCap Fund", aka: "dba Emerald Group Holdings LLC", lienRiskLevel: 1, coj: true, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Wells Advance", lienRiskLevel: 1, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Xpress Capital", lienRiskLevel: 1, coj: true, venue: "NY", notes: "COJ in contract." },
  { name: "Ace Funding", lienRiskLevel: 3, venue: "NY", notes: "Files lawsuits." },
  { name: "Alternative Funding", lienRiskLevel: 3, venue: "NY", notes: "Will get liened / we know them if client gets liened or sued." },
  { name: "Amsterdam Capital Solutions", aka: "ACS", lienRiskLevel: 3, venue: "NY", notes: "Usually uses Berkovitch & Bouskila to file a lien and a lawsuit quickly." },
  { name: "Arsenal Funding", aka: "Prosperum Capital", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Usually uses Berkovitch & Bouskila to file a lien and a lawsuit quickly. COJ." },
  { name: "Avanza Capital", lienRiskLevel: 3, venue: "NY", notes: "Will lien." },
  { name: "BizFund LLC", aka: "Smart Business Funding / Cedar Funding / Creative", lienRiskLevel: 3, venue: "NY", notes: "Will lien." },
  { name: "Blade Funding", lienRiskLevel: 3, venue: "NY", notes: "Files liens and lawsuits right away." },
  { name: "Bow Apple Capital", lienRiskLevel: 3, venue: "NY", notes: "Files liens and lawsuits right away." },
  { name: "Broadway", lienRiskLevel: 3, venue: "NY", notes: "Will file a lawsuit - Berkovitch & Bouskila." },
  { name: "ByzFunder", lienRiskLevel: 3, coj: true, venue: "NY", notes: "COJ - will sue quickly." },
  { name: "Capytal.com", aka: "A division of NexiCO", lienRiskLevel: 3, venue: "NY", notes: "Need attorney to negotiate." },
  { name: "Cashable", lienRiskLevel: 3, venue: "NY", notes: "Will file lien and lawsuit." },
  { name: "Cashfloit", lienRiskLevel: 3, venue: "NY", notes: "Will lien quickly." },
  { name: "CFG", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Will lien quickly." },
  { name: "Clearfund Solutions, LLC", aka: "Apex Clearing", lienRiskLevel: 3, venue: "NY", notes: "Will lien and file lawsuits right away." },
  { name: "Diesel funding", lienRiskLevel: 3, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Diverse Capital", lienRiskLevel: 3, venue: "NY", notes: "Will lien and file lawsuits right away." },
  { name: "E Advance Services", aka: "LLSV / Cana Cap", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Has a COJ in lender's agreement." },
  { name: "Eagle Eye", lienRiskLevel: 3, coj: true, venue: "NY", notes: "COJ immediately / UCC lien." },
  { name: "Emmy Capital", aka: "Empire Recovery", lienRiskLevel: 3, coj: true, venue: "NY, TX", notes: "COJ on contract (files in NY and TX) - sues right away, uses attorney Maksim Leyvi. Will also lien and try to draft client's bank account for the full balance owed." },
  { name: "Essential", lienRiskLevel: 3, venue: "NY", notes: "Will lien AR right away." },
  { name: "Fenix Capital", lienRiskLevel: 3, venue: "NY", notes: "CHANGE BANKS immediately. Will lien." },
  { name: "Fintap", aka: "RDM Capital Funding", lienRiskLevel: 3, venue: "NY", notes: "Will lien and file lawsuits right away / could get resolved quickly on good terms." },
  { name: "Fratello", lienRiskLevel: 3, venue: "NY", notes: "Will enforce lien immediately." },
  { name: "Fundamental Capital", aka: "Smart Funds Funding / Rapid Ruling", lienRiskLevel: 3, venue: "NY", notes: "Will definitely sue, may go after receivables - use Jonathan Borg and Bryan Bryks (attorneys)." },
  { name: "Funds Funding", lienRiskLevel: 3, venue: "NY", notes: "Rafi will work with us - will lien AR immediately; Rafi and Alex will settle right away with a discount and payments." },
  { name: "GFE", aka: "Global Funding Experts", lienRiskLevel: 3, venue: "NY", notes: "Will file lien and lawsuit right away." },
  { name: "Globex Funding", lienRiskLevel: 3, venue: "NY", notes: "Will enforce lien immediately." },
  { name: "Global Merchant Cash", lienRiskLevel: 3, venue: "NY", notes: "Will lien and file lawsuits right away." },
  { name: "GMC Funding", lienRiskLevel: 3, venue: "NY" },
  { name: "Green Note Capital", lienRiskLevel: 3, venue: "NY", notes: "Will lien / will file a lawsuit and lien right away." },
  { name: "Highland Hill", lienRiskLevel: 3, venue: "NY" },
  { name: "iFund Co", lienRiskLevel: 3, venue: "NY" },
  { name: "In Advance", lienRiskLevel: 3, venue: "NY", notes: "Uses Berkovitch & Bouskila to file a lien and a lawsuit quickly. Full balance settlements. The bigger the debt the more aggressive." },
  { name: "Kalamata Capital Group LLC", aka: "Black Olive Capital / Kings Cash Group (KCG)", plaidFinicity: true, lienRiskLevel: 3, coj: true, venue: "NY", notes: "COJ in agreement. No lien enforcement but will sue or file an arbitration quickly, usually 7 days to respond - need attorney to negotiate (LCF)." },
  { name: "Mantis", aka: "Dedicated Financial", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Jeffrey Zachter will file a lawsuit quickly, liens receivables quickly; also uses Leopold & Associates to sue in NY." },
  { name: "Mint Funding", lienRiskLevel: 3, coj: true, venue: "NY", notes: "They lien quick (TRO refers to confidentiality)." },
  { name: "Merk Funding", lienRiskLevel: 3, venue: "NY", notes: "Will enforce lien immediately." },
  { name: "NewCo Capital", plaidFinicity: true, lienRiskLevel: 3, coj: true, venue: "NY", notes: "Has COJ / will file a lawsuit - Berkovitch & Bouskila." },
  { name: "Overton Funding", lienRiskLevel: 3, tro: true, venue: "NY", notes: "Will lien receivables." },
  { name: "Pac Western", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Files a COJ immediately - sues in UT." },
  { name: "Parkview", lienRiskLevel: 3, tro: true, venue: "NY" },
  { name: "Parkside", lienRiskLevel: 3, tro: true, venue: "NY", notes: "Very aggressive and will send out UCC liens QUICKLY - Attorney Greenfield." },
  { name: "Pinnacle Lending", aka: "EN OD Capital", lienRiskLevel: 3, venue: "NY", notes: "Will enforce UCC liens." },
  { name: "Purple Tree Funding", lienRiskLevel: 3, tro: true, venue: "NY", notes: "Provision in agreement called prejudgment remedy which acts like a TRO." },
  { name: "RDM Capital Funding", aka: "Fintap", lienRiskLevel: 3, venue: "NY" },
  { name: "River Advance", lienRiskLevel: 3, tro: true, venue: "NY" },
  { name: "Roc Funding", lienRiskLevel: 3, venue: "NY" },
  { name: "Rocket capital", lienRiskLevel: 3, venue: "NY", notes: "Will file lien right away." },
  { name: "Samson", lienRiskLevel: 3, venue: "NY", notes: "Will lien receivables quickly; also sues out of NY, uses Berkovitch and Bouskila." },
  { name: "Seamless Capital", lienRiskLevel: 3, coj: true, venue: "NY" },
  { name: "Silverline", lienRiskLevel: 3, coj: true, venue: "NY" },
  { name: "Simply Funding", lienRiskLevel: 3, venue: "NY", notes: "Will lien." },
  { name: "Smart Business Funding", aka: "Bizfund / Jaffe Capital", lienRiskLevel: 3, coj: true, venue: "NY", notes: "Will file a lawsuit / COJ." },
  { name: "Smart Funding Capital", lienRiskLevel: 3, venue: "NY" },
  { name: "Sofia Grey LLC", aka: "E Financial Tree", lienRiskLevel: 3, venue: "NY", notes: "Will file a lawsuit." },
  { name: "Specialty Capital", aka: "ACH Works", lienRiskLevel: 3, tro: true, venue: "NY", notes: "Will lien and sue - Law Office of David Fogel." },
  { name: "Swift Funding Source", lienRiskLevel: 3, venue: "NY", notes: "Will lien and sue - sues in NY, uses Gorkin as the attorney." },
  { name: "The Smarter Merchant", aka: "DMKA", lienRiskLevel: 3, venue: "NY", notes: "Will lien and file lawsuit quickly." },
  { name: "Torro", lienRiskLevel: 3, venue: "UT, NY", notes: "Does not work with 3rd parties (uses Leiberman). Will lien and file lawsuit quickly." },
  { name: "United First", aka: "GFE", lienRiskLevel: 3, venue: "NY", notes: "Will lien AR quickly." },
  { name: "Vault Cap LLC", lienRiskLevel: 3, venue: "NY", notes: "Will file lawsuit + lien AR." },
  { name: "Vivian Capital", lienRiskLevel: 3, venue: "NY" },
  { name: "Vox Funding", lienRiskLevel: 3, venue: "NY", notes: "(Joe/Saul) Lieberman and Klestzick aggressive law firm (represent Fox and Vox)." },
  { name: "Wellen Capital", plaidFinicity: true, lienRiskLevel: 3, venue: "NY", notes: "Will file lien AR quickly." },
  { name: "Westwood", lienRiskLevel: 3, tro: true, venue: "NY", notes: "Sent to collections Advance Recovery Group (ARG) - may file lawsuit." },
  { name: "Yes Capital Group", aka: "Fintegra", lienRiskLevel: 3, coj: true, venue: "NY", notes: "We've been able to settle with their attorney David Fogel. Will file a lawsuit and may also file an INJUNCTION to restrain bank accounts - immediately need to change banks." },
  { name: "KRS Partners", lienRiskLevel: 3, coj: true, venue: "NY", notes: "COJ attachment." },
  { name: "VIBRANT FUNDING LLC", lienRiskLevel: 3, coj: true, tro: true, venue: "NY" },
  { name: "SLATE ADVANCE", lienRiskLevel: 3, venue: "NY" },
  { name: "Barclays Advance", lienRiskLevel: 3, venue: "NY" },
  { name: "Lazarus Capital", lienRiskLevel: 2, venue: "NY" },
  { name: "BIG Blackbridge Investment Group", coj: true, venue: "NY", notes: "COJs in contract." },
  { name: "Sinclair", coj: true, venue: "NY", notes: "COJs in contract on front page." },
  { name: "IMS FUND LLC", coj: true, venue: "NY", notes: "COJs in contract." },
  { name: "Woodmere Financial", coj: true, venue: "NY", notes: "COJs in contract." },
  { name: "Novus", coj: true, venue: "NY", notes: "COJs in contract." },
  { name: "eFinancial Tree", venue: "NY" },
  { name: "GCap Holdings LLC", venue: "NY" },
  { name: "LAG Holdings", venue: "NY" },
  { name: "Millstone", venue: "NY", notes: "Uses Dedicated Financial GBC (formerly Dedicated Commercial Recovery Inc.) for collections." },
  { name: "Paladin Funding Group", coj: true, venue: "NY" },
  { name: "Symplifi", venue: "NY" },
  { name: "Invictus Partners LLC", coj: true, venue: "NY" },
  { name: "SunBiz Funding", venue: "NY" },
  { name: "JRG", tro: true, venue: "NY" },
  { name: "Funding Future", lienRiskLevel: 3, venue: "NY" },
  { name: "Bridge Funding Cap", lienRiskLevel: 3, coj: true, venue: "NY, TX, CT", notes: "Jason Peterson will work with us. Has COJ buried at the bottom of page 3 of agreement, 1 line mentioning the COJ. Will file in NY, TX or CT per agreement." },
];

const norm = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");

/** Find intel for a lender name, matching main names and AKA/DBA aliases. */
export function findLenderIntel(name: string | null | undefined): LenderIntel | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  for (const l of LENDER_INTEL) {
    if (norm(l.name) === n) return l;
  }
  for (const l of LENDER_INTEL) {
    const akas = (l.aka ?? "").split("/").map((a) => norm(a)).filter(Boolean);
    if (akas.includes(n)) return l;
  }
  // partial: picked name contains the intel name or vice versa (min 5 chars)
  for (const l of LENDER_INTEL) {
    const ln = norm(l.name);
    if (ln.length >= 5 && (n.includes(ln) || ln.includes(n))) return l;
  }
  return null;
}
