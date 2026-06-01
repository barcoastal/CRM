/**
 * Record-type catalogs for the four objects that use them.
 * Mirrors Salesforce record types: a per-object enum that gates layout,
 * validation, and business logic.
 */

export const LEAD_RECORD_TYPES = [
  "WEB",
  "DIRECT_MAIL",
  "LIST",
  "BUSINESS",
  "ARCHIVED_WEB",
  "ARCHIVED_DIRECT_MAIL",
  "ARCHIVED_LIST",
] as const;
export type LeadRecordType = typeof LEAD_RECORD_TYPES[number];

export const ACCOUNT_RECORD_TYPES = [
  "CLIENT",
  "CREDITOR",
  "VENDOR",
  "BUSINESS_ACCOUNT",
  "PERSON_ACCOUNT",
  "BUYOUT",
  "OTHER",
] as const;
export type AccountRecordType = typeof ACCOUNT_RECORD_TYPES[number];

export const OPPORTUNITY_RECORD_TYPES = [
  "DEBT_SETTLEMENT",
  "BUYOUT",
  "RESTRUCTURE",
  "LIMITED_ASSET_PROTECTION",
] as const;
export type OpportunityRecordType = typeof OPPORTUNITY_RECORD_TYPES[number];

// ProgramPlan record types mirror Opportunity products
export const PROGRAM_PLAN_RECORD_TYPES = OPPORTUNITY_RECORD_TYPES;
export type ProgramPlanRecordType = OpportunityRecordType;

export const SETTLEMENT_RECORD_TYPES = [
  "STANDARD",
  "LITIGATION",
  "BUYOUT",
  "WORKOUT",
] as const;
export type SettlementRecordType = typeof SETTLEMENT_RECORD_TYPES[number];

export const FEE_RECORD_TYPES = [
  "SETUP",
  "MONTHLY_ADMIN",
  "SETTLEMENT_SUCCESS",
  "CANCELLATION",
  "OTHER",
] as const;
export type FeeRecordType = typeof FEE_RECORD_TYPES[number];

export const isProgramPlanRecordType = (v: string): v is ProgramPlanRecordType =>
  (PROGRAM_PLAN_RECORD_TYPES as readonly string[]).includes(v);
export const isSettlementRecordType = (v: string): v is SettlementRecordType =>
  (SETTLEMENT_RECORD_TYPES as readonly string[]).includes(v);
export const isFeeRecordType = (v: string): v is FeeRecordType =>
  (FEE_RECORD_TYPES as readonly string[]).includes(v);

export const isLeadRecordType = (v: string): v is LeadRecordType =>
  (LEAD_RECORD_TYPES as readonly string[]).includes(v);
export const isAccountRecordType = (v: string): v is AccountRecordType =>
  (ACCOUNT_RECORD_TYPES as readonly string[]).includes(v);
export const isOpportunityRecordType = (v: string): v is OpportunityRecordType =>
  (OPPORTUNITY_RECORD_TYPES as readonly string[]).includes(v);

/**
 * Archived lead variants — used for "soft delete" without losing data.
 * UI filters them out of the active inbox by default.
 */
export const ARCHIVED_LEAD_RECORD_TYPES: readonly LeadRecordType[] = [
  "ARCHIVED_WEB",
  "ARCHIVED_DIRECT_MAIL",
  "ARCHIVED_LIST",
];

export function isArchivedLead(recordType: string): boolean {
  return (ARCHIVED_LEAD_RECORD_TYPES as readonly string[]).includes(recordType);
}

/**
 * Pure helper: when a Lead is converted, what is the most natural Account record type?
 * - WEB / LIST → BUSINESS_ACCOUNT (default for B2B funnel)
 * - DIRECT_MAIL with no businessName → PERSON_ACCOUNT
 * - BUSINESS → BUSINESS_ACCOUNT
 */
export function defaultAccountRecordTypeForLead(args: {
  leadRecordType: string;
  hasBusinessName: boolean;
}): AccountRecordType {
  if (!args.hasBusinessName) return "PERSON_ACCOUNT";
  return "BUSINESS_ACCOUNT";
}

/**
 * Active (non-archived) lead record types — for the UI dropdown when creating
 * a new lead manually.
 */
export const ACTIVE_LEAD_RECORD_TYPES: readonly LeadRecordType[] = [
  "WEB",
  "DIRECT_MAIL",
  "LIST",
  "BUSINESS",
];
