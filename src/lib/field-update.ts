/**
 * Shared field-update plumbing for inline editing on Lead, Opportunity, Account,
 * and Contact detail pages. Each entity exposes a whitelist of Prisma columns
 * that may be patched from the UI; everything else lands in sfDataJson so we
 * never lose data even when the typed column doesn't exist yet.
 *
 * Routes mount this helper at /api/<entity>/[id]/field and accept a body
 * shaped like { "<fieldName>": <newValue> } — one field per request mirrors how
 * the SF inline pencil works.
 */

export type EntityType = "lead" | "opportunity" | "account" | "contact";

export type ColumnKind = "string" | "number" | "boolean" | "date";

interface ColumnSpec {
  kind: ColumnKind;
  /** Optional sfDataJson mirror key — when set, the same value is written to
   *  sfDataJson under this key. Useful for fields like `lead.phone` ↔
   *  `sfDataJson.Phone` so SF parity reads stay accurate. */
  mirrorSfKey?: string;
}

/**
 * Whitelisted typed columns per entity. Adding a row here makes that field
 * editable via /api/<entity>/[id]/field. The kind drives the coercion logic
 * (string vs number vs ISO date string → Date).
 */
export const LEAD_COLUMNS: Record<string, ColumnSpec> = {
  businessName: { kind: "string" },
  contactName: { kind: "string" },
  phone: { kind: "string", mirrorSfKey: "Phone" },
  email: { kind: "string", mirrorSfKey: "Email" },
  ein: { kind: "string" },
  industry: { kind: "string", mirrorSfKey: "Industry" },
  annualRevenue: { kind: "number", mirrorSfKey: "AnnualRevenue" },
  totalDebtEst: { kind: "number" },
  source: { kind: "string" },
  status: { kind: "string" },
  score: { kind: "number" },
  notes: { kind: "string" },
  utmSource: { kind: "string" },
  utmMedium: { kind: "string" },
  utmCampaign: { kind: "string" },
  utmTerm: { kind: "string" },
  utmContent: { kind: "string" },
  gclid: { kind: "string" },
  fbclid: { kind: "string" },
  adClickId: { kind: "string" },
  state: { kind: "string" },
  nextFollowUpAt: { kind: "date" },
  lastContactedAt: { kind: "date" },
  lastDisposition: { kind: "string" },
  lastSubDisposition: { kind: "string" },
};

export const OPPORTUNITY_COLUMNS: Record<string, ColumnSpec> = {
  name: { kind: "string" },
  stage: { kind: "string" },
  recordType: { kind: "string" },
  version: { kind: "string" },
  totalDebt: { kind: "number" },
  currentTotalDebt: { kind: "number" },
  estimatedTotalDebt: { kind: "number" },
  currentWeeklyPayment: { kind: "number" },
  currentMonthlyPayment: { kind: "number" },
  weeklyPaymentToDebtRatio: { kind: "number" },
  amount: { kind: "number" },
  probability: { kind: "number" },
  expectedCloseDate: { kind: "date" },
  closeDate: { kind: "date" },
  firstDraftDate: { kind: "date" },
  firstContractSignedDateOpp: { kind: "date" },
  lastContactedAt: { kind: "date" },
  notes: { kind: "string" },
  nextStep: { kind: "string" },
  leadSource: { kind: "string" },
  leadSourceCategory: { kind: "string" },
  subDisposition: { kind: "string" },
  fronter: { kind: "string" },
  closer: { kind: "string" },
  callTransferStatus: { kind: "string" },
  transferQualification: { kind: "string" },
  oppPhone: { kind: "string", mirrorSfKey: "Phone__c" },
  oppEmail: { kind: "string", mirrorSfKey: "Email__c" },
  timezone: { kind: "string", mirrorSfKey: "Timezone__c" },
  preferredLanguage: { kind: "string", mirrorSfKey: "Preferred_Language__c" },
  preferredMethodOfContact: { kind: "string", mirrorSfKey: "Preferred_method_of_Contact__c" },
  dialerGroup: { kind: "string", mirrorSfKey: "Dialer_Group__c" },
  businessStartDate: { kind: "date", mirrorSfKey: "Business_Start_Date__c" },
  legalPlanRequired: { kind: "boolean", mirrorSfKey: "Legal_Plan_Required__c" },
  addendumRequired: { kind: "boolean", mirrorSfKey: "Addendum_Required__c" },
  securedParty: { kind: "string", mirrorSfKey: "Secured_Party__c" },
  highUccRisk: { kind: "boolean", mirrorSfKey: "HIGH_UCC_RISK__c" },
  cojOrTro: { kind: "string", mirrorSfKey: "COJ_or_TRO__c" },
  summonsOrJudgment: { kind: "string", mirrorSfKey: "Summons_or_Judgment__c" },
  orderNumber: { kind: "string", mirrorSfKey: "OrderNumber__c" },
  currentGenerators: { kind: "string", mirrorSfKey: "CurrentGenerators__c" },
  trackingNumber: { kind: "string", mirrorSfKey: "TrackingNumber__c" },
  lossReason: { kind: "string", mirrorSfKey: "Loss_Reason__c" },
  processorInfo: { kind: "string", mirrorSfKey: "Processor_Info__c" },
  lenderAgreementsCollected: { kind: "string", mirrorSfKey: "Lender_Agreements_Collected__c" },
  statusWithLenders: { kind: "string", mirrorSfKey: "Status_with_Lender_s__c" },
  firstPaymentToLegal: { kind: "boolean", mirrorSfKey: "First_Payment_to_Legal__c" },
  welcomeCallScheduled: { kind: "date", mirrorSfKey: "Welcome_Call_Scheduled__c" },
  whatWasExplainedToClient: { kind: "string", mirrorSfKey: "What_was_explained_to_client__c" },
  mainCompetitors: { kind: "string", mirrorSfKey: "MainCompetitors__c" },
  deliveryInstallationStatus: { kind: "string", mirrorSfKey: "DeliveryInstallationStatus__c" },
  typeOfBusiness: { kind: "string" },
  receivablesCollectionMethod: { kind: "string" },
  bankChange: { kind: "string" },
  highLienRisk: { kind: "string" },
};

export const ACCOUNT_COLUMNS: Record<string, ColumnSpec> = {
  name: { kind: "string" },
  recordType: { kind: "string" },
  type: { kind: "string" },
  ein: { kind: "string" },
  ssnLast4: { kind: "string" },
  phone: { kind: "string", mirrorSfKey: "Phone" },
  email: { kind: "string" },
  website: { kind: "string", mirrorSfKey: "Website" },
  industry: { kind: "string", mirrorSfKey: "Industry" },
  annualRevenue: { kind: "number", mirrorSfKey: "AnnualRevenue" },
  numberOfEmployees: { kind: "number", mirrorSfKey: "NumberOfEmployees" },
  description: { kind: "string" },
  billingStreet: { kind: "string", mirrorSfKey: "BillingStreet" },
  billingCity: { kind: "string", mirrorSfKey: "BillingCity" },
  billingState: { kind: "string", mirrorSfKey: "BillingState" },
  billingZip: { kind: "string", mirrorSfKey: "BillingPostalCode" },
  billingCountry: { kind: "string", mirrorSfKey: "BillingCountry" },
  stage: { kind: "string" },
  clientStatus: { kind: "string" },
  processorStatus: { kind: "string" },
  paymentStatus: { kind: "string" },
  bankAccountStatus: { kind: "string" },
  programStartDate: { kind: "date" },
  programEndDate: { kind: "date" },
  businessStartDate: { kind: "date" },
  uccFilingDate: { kind: "date" },
  cancellationDate: { kind: "date" },
  cancellationReason: { kind: "string" },
  legalStatus: { kind: "string" },
  submittedByLegal: { kind: "string" },
  rescheduleStatus: { kind: "string" },
  conversionReason: { kind: "string" },
  loanProvider: { kind: "string" },
  collectionAgency: { kind: "string" },
  externalSasId: { kind: "string" },
  externalRamId: { kind: "string" },
  uccFilingId: { kind: "string" },
  bankAccountSyncStatus: { kind: "string" },
  paymentProcessor: { kind: "string" },
  qualifiedStatus: { kind: "string" },
  highUccRisk: { kind: "boolean" },
  graduatedStatus: { kind: "string" },
  operatingExpenses: { kind: "number" },
  netProfit: { kind: "number" },
  ebitda: { kind: "number" },
  grossProfit: { kind: "number" },
  debtPayments: { kind: "number" },
  buyoutProgramWeeklyPayment: { kind: "number" },
  buyoutProgramMonthlyPayment: { kind: "number" },
  financialDescription: { kind: "string" },
  bankName: { kind: "string" },
  bankRoutingNumber: { kind: "string" },
  bankAccountNumber: { kind: "string" },
  bankAccountType: { kind: "string" },
  feePaidInFull: { kind: "boolean" },
  welcomeCallCompleted: { kind: "boolean" },
  firstPaymentReceived: { kind: "boolean" },
};

export const CONTACT_COLUMNS: Record<string, ColumnSpec> = {
  firstName: { kind: "string", mirrorSfKey: "FirstName" },
  lastName: { kind: "string", mirrorSfKey: "LastName" },
  fullName: { kind: "string" },
  email: { kind: "string", mirrorSfKey: "Email" },
  phone: { kind: "string", mirrorSfKey: "Phone" },
  mobilePhone: { kind: "string", mirrorSfKey: "MobilePhone" },
  title: { kind: "string", mirrorSfKey: "Title" },
  birthdate: { kind: "date", mirrorSfKey: "Birthdate" },
};

export function columnsFor(entity: EntityType): Record<string, ColumnSpec> {
  switch (entity) {
    case "lead":
      return LEAD_COLUMNS;
    case "opportunity":
      return OPPORTUNITY_COLUMNS;
    case "account":
      return ACCOUNT_COLUMNS;
    case "contact":
      return CONTACT_COLUMNS;
  }
}

/** Detect a Salesforce custom-field key (e.g. Phone__c, DS_*__c). */
function isSfDataKey(name: string): boolean {
  // Recognize SF custom (__c suffix), SF standard names with capital camelCase
  // like "FirstName", "CreatedDate", and SF picklists. Anything that looks like
  // a typical Prisma column (camelCase starting lowercase, no __) is treated as
  // a typed column candidate; the registry lookup is the source of truth though.
  return name.endsWith("__c") || /^[A-Z]/.test(name);
}

interface ApplyResult {
  /** Coerced value to set on the typed column (when the field is a known column). */
  typedColumn?: { name: string; value: string | number | boolean | Date | null };
  /** sfDataJson updates to merge in. */
  sfDataPatch?: Record<string, unknown>;
  /** Field name suitable for the history table. */
  historyField: string;
  /** Old display value (string). */
  oldDisplay: string | null;
  /** New display value (string). */
  newDisplay: string | null;
}

/**
 * Convert a raw PATCH body { fieldName: newValue } into the typed column update +
 * sfDataJson patch. Throws on unknown fields so the route can reply 400.
 */
export function applyFieldUpdate(args: {
  entity: EntityType;
  fieldName: string;
  newValue: unknown;
  existingSfDataJson: string | null | undefined;
  existingRecord: Record<string, unknown>;
}): ApplyResult {
  const { entity, fieldName, newValue, existingSfDataJson, existingRecord } = args;
  const cols = columnsFor(entity);

  let sfData: Record<string, unknown> = {};
  if (existingSfDataJson) {
    try { sfData = JSON.parse(existingSfDataJson) as Record<string, unknown>; } catch { /* ignore */ }
  }

  // Direct typed-column hit.
  if (cols[fieldName]) {
    const spec = cols[fieldName];
    const coerced = coerce(newValue, spec.kind);
    const oldDisplay = displayOf(existingRecord[fieldName]);
    const newDisplay = displayOf(coerced);
    const sfDataPatch: Record<string, unknown> = {};
    if (spec.mirrorSfKey) {
      sfDataPatch[spec.mirrorSfKey] = coerced instanceof Date ? coerced.toISOString() : coerced;
    }
    return {
      typedColumn: { name: fieldName, value: coerced },
      sfDataPatch: Object.keys(sfDataPatch).length ? sfDataPatch : undefined,
      historyField: fieldName,
      oldDisplay,
      newDisplay,
    };
  }

  // sfDataJson-only field. Accept anything that looks like an SF key.
  if (isSfDataKey(fieldName)) {
    const oldDisplay = displayOf(sfData[fieldName]);
    const coerced = typeof newValue === "string" ? newValue : (newValue as string | number | boolean | null);
    const newDisplay = displayOf(coerced);
    return {
      sfDataPatch: { [fieldName]: coerced },
      historyField: fieldName,
      oldDisplay,
      newDisplay,
    };
  }

  throw new FieldUpdateError(`Field '${fieldName}' is not editable on ${entity}.`);
}

export class FieldUpdateError extends Error {}

function coerce(v: unknown, kind: ColumnKind): string | number | boolean | Date | null {
  if (v === null || v === undefined || v === "") {
    return null;
  }
  switch (kind) {
    case "string":
      return typeof v === "string" ? v : String(v);
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) throw new FieldUpdateError("Invalid number");
      return n;
    }
    case "boolean": {
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      if (["true", "1", "yes"].includes(s)) return true;
      if (["false", "0", "no"].includes(s)) return false;
      throw new FieldUpdateError("Invalid boolean");
    }
    case "date": {
      if (v instanceof Date) return v;
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) throw new FieldUpdateError("Invalid date");
      return d;
    }
  }
}

function displayOf(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** Merge sfDataJson patch with the existing JSON and stringify. */
export function mergeSfData(existing: string | null | undefined, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try { base = JSON.parse(existing) as Record<string, unknown>; } catch { /* ignore */ }
  }
  return JSON.stringify({ ...base, ...patch });
}
