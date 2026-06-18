/**
 * Pure mapping from a Salesforce Account row (sfDataJson) to a CRM Account
 * field patch. Phase 1 = ownership + always-present flags/basics. No DB access;
 * resolvers are passed in so the same logic drives the dry-run and the real
 * backfill.
 */

export type SfRow = Record<string, unknown>;

export interface OwnerResolvers {
  byName: (name: string) => string | undefined; // lowercased name -> userId
  bySfId: (sfId: string) => string | undefined; // SF OwnerId -> userId
}

export type AccountPatch = {
  ownerId?: string;
  highUccRisk?: boolean;
  feePaidInFull?: boolean;
  qualifiedStatus?: string;
  currentTotalDebt?: number;
  industry?: string;
  phone?: string;
  billingState?: string;
  billingCity?: string;
  billingStreet?: string;
  billingZip?: string;
};

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};
const bool = (v: unknown): boolean | undefined => {
  const s = str(v);
  if (s === undefined) return undefined;
  return /^(true|1|yes)$/i.test(s);
};
const num = (v: unknown): number | undefined => {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/** Resolve the SF owner to a CRM userId (name first — highest coverage — then sfId). */
export function resolveOwner(sf: SfRow, r: OwnerResolvers): string | undefined {
  const name = str(sf.Owner_Full_Name__c);
  if (name) {
    const byName = r.byName(name.toLowerCase());
    if (byName) return byName;
  }
  const oid = str(sf.OwnerId);
  if (oid) {
    const bySf = r.bySfId(oid);
    if (bySf) return bySf;
  }
  return undefined;
}

/** Build the Phase 1 patch. Only includes fields the SF row actually carries. */
export function buildPhase1Patch(sf: SfRow, r: OwnerResolvers): AccountPatch {
  const patch: AccountPatch = {};
  const owner = resolveOwner(sf, r);
  if (owner) patch.ownerId = owner;

  const ucc = bool(sf.HIGH_UCC_RISK__c);
  if (ucc !== undefined) patch.highUccRisk = ucc;

  const fee = bool(sf.Fee_Paid_In_Full__c);
  if (fee !== undefined) patch.feePaidInFull = fee;

  const qualified = bool(sf.Qualified_Financial__c);
  if (qualified) patch.qualifiedStatus = "Qualified";

  const debt = num(sf.Total_Debt__c);
  if (debt !== undefined) patch.currentTotalDebt = debt;

  const industry = str(sf.Industry);
  if (industry) patch.industry = industry;

  const phone = str(sf.Phone);
  if (phone) patch.phone = phone;

  const billingState = str(sf.BillingState) ?? str(sf.BillingStateCode);
  if (billingState) patch.billingState = billingState;
  const billingCity = str(sf.BillingCity);
  if (billingCity) patch.billingCity = billingCity;
  const billingStreet = str(sf.BillingStreet);
  if (billingStreet) patch.billingStreet = billingStreet;
  const billingZip = str(sf.BillingPostalCode);
  if (billingZip) patch.billingZip = billingZip;

  return patch;
}

export const PHASE1_FIELDS: (keyof AccountPatch)[] = [
  "ownerId", "highUccRisk", "feePaidInFull", "qualifiedStatus",
  "currentTotalDebt", "industry", "phone", "billingState", "billingCity", "billingStreet", "billingZip",
];
