// Object metadata for the report builder. Each entry describes a Prisma model
// that report users can build reports against. We expose a curated set of
// columns per object (direct columns, relation columns, JSON paths, computed).
//
// `prismaModel` matches `prisma[<key>]` (lowercase). `source` controls how the
// report runner resolves the value at fetch time.

export type FieldSource = "column" | "relation" | "json" | "computed";

export type FieldType = "string" | "number" | "boolean" | "date" | "enum";

export interface ObjectField {
  /** Dot-path key. For relations like "owner.name". For JSON like "sfDataJson.Campaign__c". */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Field type. Drives operator selection + value coercion. */
  type: FieldType;
  /** How the value is sourced from the model. */
  source: FieldSource;
  /**
   * For `source: "relation"`, the top-level Prisma include key (e.g. "owner", "account").
   * Multiple fields can share the same relation key.
   */
  relation?: string;
  /**
   * For `source: "json"`, the column on the model that holds the JSON string ("sfDataJson").
   */
  jsonColumn?: string;
  /** Optional enum values when `type: "enum"`. */
  options?: string[];
}

export interface ObjectMetadata {
  /** Display label. */
  label: string;
  /** Plural label for headers / pickers. */
  pluralLabel: string;
  /** Prisma model accessor (e.g. "lead" => prisma.lead). */
  prismaModel: string;
  /** Short description shown on the new-report picker. */
  description: string;
  /** Field list available in the report builder. */
  fields: ObjectField[];
  /** Default columns selected when starting a fresh report on this object. */
  defaultColumns: string[];
}

// ============ LEAD ============

const LEAD_FIELDS: ObjectField[] = [
  { key: "id", label: "Lead ID", type: "string", source: "column" },
  { key: "businessName", label: "Business Name", type: "string", source: "column" },
  { key: "contactName", label: "Contact Name", type: "string", source: "column" },
  { key: "phone", label: "Phone", type: "string", source: "column" },
  { key: "email", label: "Email", type: "string", source: "column" },
  { key: "ein", label: "EIN", type: "string", source: "column" },
  { key: "industry", label: "Industry", type: "string", source: "column" },
  { key: "state", label: "State", type: "string", source: "column" },
  { key: "annualRevenue", label: "Annual Revenue", type: "number", source: "column" },
  { key: "totalDebtEst", label: "Estimated Total Debt", type: "number", source: "column" },
  { key: "currentTotalWeeklyPayment", label: "Current Weekly Payment", type: "number", source: "column" },
  { key: "source", label: "Source", type: "string", source: "column" },
  { key: "status", label: "Status", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "score", label: "Score", type: "number", source: "column" },
  { key: "lastDisposition", label: "Last Disposition", type: "string", source: "column" },
  { key: "lastSubDisposition", label: "Sub-Disposition", type: "string", source: "column" },
  { key: "lastDispositionAt", label: "Last Disposition At", type: "date", source: "column" },
  { key: "lastContactedAt", label: "Last Contacted At", type: "date", source: "column" },
  { key: "nextFollowUpAt", label: "Next Follow-Up At", type: "date", source: "column" },
  { key: "leadAssignmentDate", label: "Assigned Date", type: "date", source: "column" },
  { key: "utmSource", label: "UTM Source", type: "string", source: "column" },
  { key: "utmCampaign", label: "UTM Campaign", type: "string", source: "column" },
  { key: "utmMedium", label: "UTM Medium", type: "string", source: "column" },
  { key: "gclid", label: "Google Click ID", type: "string", source: "column" },
  { key: "leadVendorId", label: "Lead Vendor ID", type: "string", source: "column" },
  { key: "adId", label: "Ad ID", type: "string", source: "column" },
  { key: "campaignName", label: "Campaign Name", type: "string", source: "column" },
  { key: "convertedAt", label: "Converted At", type: "date", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "assignedTo.name", label: "Owner Name", type: "string", source: "relation", relation: "assignedTo" },
  { key: "assignedTo.email", label: "Owner Email", type: "string", source: "relation", relation: "assignedTo" },
  { key: "sfDataJson.Campaign__c", label: "SF Campaign", type: "string", source: "json", jsonColumn: "sfDataJson" },
  { key: "sfDataJson.LeadSource", label: "SF Lead Source", type: "string", source: "json", jsonColumn: "sfDataJson" },
];

// ============ OPPORTUNITY ============

const OPP_FIELDS: ObjectField[] = [
  { key: "id", label: "Opportunity ID", type: "string", source: "column" },
  { key: "name", label: "Name", type: "string", source: "column" },
  { key: "stage", label: "Stage", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "amount", label: "Amount", type: "number", source: "column" },
  { key: "totalDebt", label: "Total Debt", type: "number", source: "column" },
  { key: "currentTotalDebt", label: "Current Total Debt", type: "number", source: "column" },
  { key: "estimatedTotalDebt", label: "Estimated Total Debt", type: "number", source: "column" },
  { key: "currentWeeklyPayment", label: "Current Weekly Payment", type: "number", source: "column" },
  { key: "currentMonthlyPayment", label: "Current Monthly Payment", type: "number", source: "column" },
  { key: "probability", label: "Probability %", type: "number", source: "column" },
  { key: "lastDisposition", label: "Last Disposition", type: "string", source: "column" },
  { key: "lastSubDisposition", label: "Sub-Disposition", type: "string", source: "column" },
  { key: "lastDispositionAt", label: "Last Disposition At", type: "date", source: "column" },
  { key: "isClosed", label: "Is Closed", type: "boolean", source: "column" },
  { key: "isWon", label: "Is Won", type: "boolean", source: "column" },
  { key: "expectedCloseDate", label: "Expected Close Date", type: "date", source: "column" },
  { key: "closeDate", label: "Close Date", type: "date", source: "column" },
  { key: "firstDraftDate", label: "First Draft Date", type: "date", source: "column" },
  { key: "lastContactedAt", label: "Last Contacted At", type: "date", source: "column" },
  { key: "lastCallAt", label: "Last Call At", type: "date", source: "column" },
  { key: "oppPhone", label: "Phone", type: "string", source: "column" },
  { key: "oppEmail", label: "Email", type: "string", source: "column" },
  { key: "leadSource", label: "Lead Source", type: "string", source: "column" },
  { key: "leadSourceCategory", label: "Lead Source Category", type: "string", source: "column" },
  { key: "fronter", label: "Fronter", type: "string", source: "column" },
  { key: "closer", label: "Closer", type: "string", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "assignedTo.name", label: "Owner Name", type: "string", source: "relation", relation: "assignedTo" },
  { key: "assignedTo.email", label: "Owner Email", type: "string", source: "relation", relation: "assignedTo" },
  { key: "account.name", label: "Account Name", type: "string", source: "relation", relation: "account" },
  { key: "account.industry", label: "Account Industry", type: "string", source: "relation", relation: "account" },
  { key: "account.stage", label: "Account Stage", type: "string", source: "relation", relation: "account" },
  { key: "sfDataJson.LeadSource", label: "SF Lead Source", type: "string", source: "json", jsonColumn: "sfDataJson" },
];

// ============ ACCOUNT ============

const ACCOUNT_FIELDS: ObjectField[] = [
  { key: "id", label: "Account ID", type: "string", source: "column" },
  { key: "name", label: "Name", type: "string", source: "column" },
  { key: "type", label: "Type", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "stage", label: "Stage", type: "string", source: "column" },
  { key: "clientStatus", label: "Client Status", type: "string", source: "column" },
  { key: "processorStatus", label: "Processor Status", type: "string", source: "column" },
  { key: "paymentStatus", label: "Payment Status", type: "string", source: "column" },
  { key: "bankAccountStatus", label: "Bank Account Status", type: "string", source: "column" },
  { key: "ein", label: "EIN", type: "string", source: "column" },
  { key: "phone", label: "Phone", type: "string", source: "column" },
  { key: "email", label: "Email", type: "string", source: "column" },
  { key: "industry", label: "Industry", type: "string", source: "column" },
  { key: "annualRevenue", label: "Annual Revenue", type: "number", source: "column" },
  { key: "numberOfEmployees", label: "Employees", type: "number", source: "column" },
  { key: "billingCity", label: "Billing City", type: "string", source: "column" },
  { key: "billingState", label: "Billing State", type: "string", source: "column" },
  { key: "billingZip", label: "Billing Zip", type: "string", source: "column" },
  { key: "billingCountry", label: "Billing Country", type: "string", source: "column" },
  { key: "programStartDate", label: "Program Start Date", type: "date", source: "column" },
  { key: "programEndDate", label: "Program End Date", type: "date", source: "column" },
  { key: "cancellationDate", label: "Cancellation Date", type: "date", source: "column" },
  { key: "cancellationReason", label: "Cancellation Reason", type: "string", source: "column" },
  { key: "paymentProcessor", label: "Payment Processor", type: "string", source: "column" },
  { key: "currentTotalDebt", label: "Current Total Debt", type: "number", source: "column" },
  { key: "escrowBalance", label: "Escrow Balance", type: "number", source: "column" },
  { key: "netProfit", label: "Net Profit", type: "number", source: "column" },
  { key: "legalStatus", label: "Legal Status", type: "string", source: "column" },
  { key: "externalSasId", label: "External SAS Id", type: "string", source: "column" },
  { key: "externalRamId", label: "External RAM Id", type: "string", source: "column" },
  { key: "firstContractSignedDate", label: "First Contract Signed Date", type: "date", source: "column" },
  { key: "feePaidInFull", label: "Fee Paid in Full", type: "boolean", source: "column" },
  { key: "welcomeCallCompleted", label: "Welcome Call Completed", type: "boolean", source: "column" },
  { key: "firstPaymentReceived", label: "First Payment Received", type: "boolean", source: "column" },
  { key: "highUccRisk", label: "High UCC Risk", type: "boolean", source: "column" },
  { key: "programCompletionStage", label: "Program Completion Stage", type: "boolean", source: "column" },
  { key: "isActive", label: "Is Active", type: "boolean", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "sfDataJson.First_Payment_Completed_Date__c", label: "First Payment Completed Date", type: "date", source: "json", jsonColumn: "sfDataJson" },
  { key: "sfDataJson.Sub_Disposition__c", label: "Sub Disposition", type: "string", source: "json", jsonColumn: "sfDataJson" },
  { key: "sfDataJson.Closer__c", label: "Closer", type: "string", source: "json", jsonColumn: "sfDataJson" },
  { key: "owner.name", label: "Owner Name", type: "string", source: "relation", relation: "owner" },
  { key: "owner.email", label: "Owner Email", type: "string", source: "relation", relation: "owner" },
  { key: "primaryContact.name", label: "Primary Contact", type: "string", source: "relation", relation: "primaryContact" },
];

// ============ CASE ============

const CASE_FIELDS: ObjectField[] = [
  { key: "id", label: "Case ID", type: "string", source: "column" },
  { key: "caseNumber", label: "Case Number", type: "string", source: "column" },
  { key: "subject", label: "Subject", type: "string", source: "column" },
  { key: "description", label: "Description", type: "string", source: "column" },
  { key: "status", label: "Status", type: "string", source: "column" },
  { key: "priority", label: "Priority", type: "string", source: "column" },
  { key: "origin", label: "Origin", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "escalationLevel", label: "Escalation Level", type: "string", source: "column" },
  { key: "requiresApproval", label: "Requires Approval", type: "boolean", source: "column" },
  { key: "approvedAt", label: "Approved At", type: "date", source: "column" },
  { key: "slaDueAt", label: "SLA Due At", type: "date", source: "column" },
  { key: "firstResponseAt", label: "First Response At", type: "date", source: "column" },
  { key: "resolvedAt", label: "Resolved At", type: "date", source: "column" },
  { key: "closedAt", label: "Closed At", type: "date", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "owner.name", label: "Owner Name", type: "string", source: "relation", relation: "owner" },
  { key: "owner.email", label: "Owner Email", type: "string", source: "relation", relation: "owner" },
  { key: "ownerGroup.name", label: "Queue Name", type: "string", source: "relation", relation: "ownerGroup" },
  { key: "createdBy.name", label: "Created By", type: "string", source: "relation", relation: "createdBy" },
  { key: "approvedBy.name", label: "Approved By", type: "string", source: "relation", relation: "approvedBy" },
  { key: "account.name", label: "Account Name", type: "string", source: "relation", relation: "account" },
  { key: "contact.fullName", label: "Contact Name", type: "string", source: "relation", relation: "contact" },
];

// ============ TASK ============

const TASK_FIELDS: ObjectField[] = [
  { key: "id", label: "Task ID", type: "string", source: "column" },
  { key: "subject", label: "Subject", type: "string", source: "column" },
  { key: "type", label: "Type", type: "string", source: "column" },
  { key: "status", label: "Status", type: "string", source: "column" },
  { key: "priority", label: "Priority", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "disposition", label: "Disposition", type: "string", source: "column" },
  { key: "outcome", label: "Outcome", type: "string", source: "column" },
  { key: "dueDate", label: "Due Date", type: "date", source: "column" },
  { key: "reminderAt", label: "Reminder At", type: "date", source: "column" },
  { key: "callbackDate", label: "Callback Date", type: "date", source: "column" },
  { key: "completedAt", label: "Completed At", type: "date", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "owner.name", label: "Owner Name", type: "string", source: "relation", relation: "owner" },
  { key: "owner.email", label: "Owner Email", type: "string", source: "relation", relation: "owner" },
  { key: "account.name", label: "Account Name", type: "string", source: "relation", relation: "account" },
  { key: "opportunity.name", label: "Opportunity Name", type: "string", source: "relation", relation: "opportunity" },
  { key: "opportunity.stage", label: "Opportunity Stage", type: "string", source: "relation", relation: "opportunity" },
  { key: "lead.businessName", label: "Lead Business", type: "string", source: "relation", relation: "lead" },
  { key: "lead.status", label: "Lead Status", type: "string", source: "relation", relation: "lead" },
  { key: "contact.fullName", label: "Contact Name", type: "string", source: "relation", relation: "contact" },
  { key: "case.caseNumber", label: "Case Number", type: "string", source: "relation", relation: "case" },
];

// ============ EVENT ============

const EVENT_FIELDS: ObjectField[] = [
  { key: "id", label: "Event ID", type: "string", source: "column" },
  { key: "subject", label: "Subject", type: "string", source: "column" },
  { key: "description", label: "Description", type: "string", source: "column" },
  { key: "location", label: "Location", type: "string", source: "column" },
  { key: "status", label: "Status", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "startAt", label: "Start", type: "date", source: "column" },
  { key: "endAt", label: "End", type: "date", source: "column" },
  { key: "allDay", label: "All Day", type: "boolean", source: "column" },
  { key: "disposition", label: "Disposition", type: "string", source: "column" },
  { key: "outcome", label: "Outcome", type: "string", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "owner.name", label: "Owner Name", type: "string", source: "relation", relation: "owner" },
  { key: "owner.email", label: "Owner Email", type: "string", source: "relation", relation: "owner" },
  { key: "account.name", label: "Account Name", type: "string", source: "relation", relation: "account" },
  { key: "opportunity.name", label: "Opportunity Name", type: "string", source: "relation", relation: "opportunity" },
  { key: "opportunity.stage", label: "Opportunity Stage", type: "string", source: "relation", relation: "opportunity" },
  { key: "lead.businessName", label: "Lead Business", type: "string", source: "relation", relation: "lead" },
  { key: "contact.fullName", label: "Contact Name", type: "string", source: "relation", relation: "contact" },
  { key: "case.caseNumber", label: "Case Number", type: "string", source: "relation", relation: "case" },
];

// ============ ENVELOPE ============

const ENVELOPE_FIELDS: ObjectField[] = [
  { key: "id", label: "Envelope ID", type: "string", source: "column" },
  { key: "documentName", label: "Document Name", type: "string", source: "column" },
  { key: "templateName", label: "Template Name", type: "string", source: "column" },
  { key: "status", label: "Status", type: "string", source: "column" },
  { key: "recordType", label: "Record Type", type: "string", source: "column" },
  { key: "signerName", label: "Signer Name", type: "string", source: "column" },
  { key: "signerEmail", label: "Signer Email", type: "string", source: "column" },
  { key: "signerPhone", label: "Signer Phone", type: "string", source: "column" },
  { key: "pages", label: "Pages", type: "number", source: "column" },
  { key: "sentAt", label: "Sent At", type: "date", source: "column" },
  { key: "viewedAt", label: "Viewed At", type: "date", source: "column" },
  { key: "signedAt", label: "Signed At", type: "date", source: "column" },
  { key: "completedAt", label: "Completed At", type: "date", source: "column" },
  { key: "voidedAt", label: "Voided At", type: "date", source: "column" },
  { key: "voidReason", label: "Void Reason", type: "string", source: "column" },
  { key: "expiresAt", label: "Expires At", type: "date", source: "column" },
  { key: "createdAt", label: "Created At", type: "date", source: "column" },
  { key: "updatedAt", label: "Updated At", type: "date", source: "column" },
  { key: "createdBy.name", label: "Created By", type: "string", source: "relation", relation: "createdBy" },
  { key: "account.name", label: "Account Name", type: "string", source: "relation", relation: "account" },
  { key: "opportunity.name", label: "Opportunity Name", type: "string", source: "relation", relation: "opportunity" },
  { key: "lead.businessName", label: "Lead Business", type: "string", source: "relation", relation: "lead" },
];

// ============ REGISTRY ============

export const OBJECT_METADATA: Record<string, ObjectMetadata> = {
  Lead: {
    label: "Lead",
    pluralLabel: "Leads",
    prismaModel: "lead",
    description: "Prospect businesses captured from marketing, lists, or referrals.",
    fields: LEAD_FIELDS,
    defaultColumns: ["businessName", "contactName", "phone", "status", "assignedTo.name", "createdAt"],
  },
  Opportunity: {
    label: "Opportunity",
    pluralLabel: "Opportunities",
    prismaModel: "opportunity",
    description: "Active deals in the pipeline, with stage, debt, and owner.",
    fields: OPP_FIELDS,
    defaultColumns: ["name", "account.name", "stage", "totalDebt", "assignedTo.name", "createdAt"],
  },
  Account: {
    label: "Account",
    pluralLabel: "Accounts",
    prismaModel: "account",
    description: "Client and creditor accounts, with program and payment status.",
    fields: ACCOUNT_FIELDS,
    defaultColumns: ["name", "stage", "clientStatus", "currentTotalDebt", "owner.name", "createdAt"],
  },
  Case: {
    label: "Case",
    pluralLabel: "Cases",
    prismaModel: "case",
    description: "Support cases, escalations, and account requests.",
    fields: CASE_FIELDS,
    defaultColumns: ["caseNumber", "subject", "status", "priority", "owner.name", "createdAt"],
  },
  Task: {
    label: "Task",
    pluralLabel: "Tasks",
    prismaModel: "task",
    description: "Activities, follow-ups, and dispositions logged against records.",
    fields: TASK_FIELDS,
    defaultColumns: ["subject", "type", "status", "owner.name", "dueDate", "createdAt"],
  },
  Event: {
    label: "Event",
    pluralLabel: "Events",
    prismaModel: "event",
    description: "Calendar events, meetings, and scheduled calls.",
    fields: EVENT_FIELDS,
    defaultColumns: ["subject", "status", "startAt", "owner.name", "account.name"],
  },
  Envelope: {
    label: "Envelope",
    pluralLabel: "Envelopes",
    prismaModel: "envelope",
    description: "E-signature envelopes, contracts, and disclosures.",
    fields: ENVELOPE_FIELDS,
    defaultColumns: ["documentName", "status", "signerName", "sentAt", "createdBy.name"],
  },
};

export const REPORTABLE_OBJECT_TYPES = Object.keys(OBJECT_METADATA);

export function getObjectMetadata(objectType: string): ObjectMetadata | null {
  return OBJECT_METADATA[objectType] ?? null;
}

export function getField(objectType: string, key: string): ObjectField | null {
  const meta = OBJECT_METADATA[objectType];
  if (!meta) return null;
  return meta.fields.find((f) => f.key === key) ?? null;
}
