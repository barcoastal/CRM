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

export const TASK_RECORD_TYPES = ["ACTIVITY", "DISPOSITION"] as const;
export type TaskRecordType = typeof TASK_RECORD_TYPES[number];
export const isTaskRecordType = (v: string): v is TaskRecordType =>
  (TASK_RECORD_TYPES as readonly string[]).includes(v);

export const EVENT_RECORD_TYPES = ["EVENT", "EVENT_DISPOSITION"] as const;
export type EventRecordType = typeof EVENT_RECORD_TYPES[number];
export const isEventRecordType = (v: string): v is EventRecordType =>
  (EVENT_RECORD_TYPES as readonly string[]).includes(v);

export const TASK_TYPES = ["CALL", "EMAIL", "LETTER", "TASK", "NOTE", "OTHER"] as const;
export type TaskType = typeof TASK_TYPES[number];

export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DEFERRED", "WAITING"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const EVENT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type EventStatus = typeof EVENT_STATUSES[number];

export const CASE_RECORD_TYPES = [
  "SUPPORT",
  "PAYMENT_ISSUE",
  "SKIP_PAYMENT",
  "CANCELLATION",
  "BANK_UPDATE",
  "DOCUMENT_REQUEST",
] as const;
export type CaseRecordType = typeof CASE_RECORD_TYPES[number];
export const isCaseRecordType = (v: string): v is CaseRecordType =>
  (CASE_RECORD_TYPES as readonly string[]).includes(v);

export const CASE_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;
export type CaseStatus = typeof CASE_STATUSES[number];

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CasePriority = typeof CASE_PRIORITIES[number];

export const CASE_ORIGINS = ["PHONE", "EMAIL", "WEB", "CHAT", "OTHER"] as const;
export type CaseOrigin = typeof CASE_ORIGINS[number];

export const ESCALATION_LEVELS = ["L1", "L2", "L3"] as const;
export type EscalationLevel = typeof ESCALATION_LEVELS[number];

export function isTerminalCaseStatus(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

export function nextEscalationLevel(current: string): EscalationLevel | null {
  if (current === "L1") return "L2";
  if (current === "L2") return "L3";
  return null;
}

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
