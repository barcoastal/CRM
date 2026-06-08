/**
 * All merge paths available to template authors. Each path is a dot-notation
 * reference into the merge context that the envelope send flow builds at
 * send time. The mapper UI uses this list to populate its dropdowns.
 */

export interface MergePath {
  value: string;
  label: string;
  group: string;
}

export const MERGE_PATHS: MergePath[] = [
  // Account
  { value: "account.firstName", label: "Account: First Name", group: "Account" },
  { value: "account.lastName", label: "Account: Last Name", group: "Account" },
  { value: "account.email", label: "Account: Email", group: "Account" },
  { value: "account.phone", label: "Account: Phone", group: "Account" },
  { value: "account.street", label: "Account: Street", group: "Account" },
  { value: "account.city", label: "Account: City", group: "Account" },
  { value: "account.state", label: "Account: State", group: "Account" },
  { value: "account.postalCode", label: "Account: Postal Code", group: "Account" },
  { value: "account.country", label: "Account: Country", group: "Account" },
  { value: "account.businessName", label: "Account: Business Name", group: "Account" },

  // Contact
  { value: "contact.firstName", label: "Contact: First Name", group: "Contact" },
  { value: "contact.lastName", label: "Contact: Last Name", group: "Contact" },
  { value: "contact.email", label: "Contact: Email", group: "Contact" },
  { value: "contact.phone", label: "Contact: Phone", group: "Contact" },

  // Opportunity
  { value: "opportunity.id", label: "Opportunity: ID", group: "Opportunity" },
  { value: "opportunity.name", label: "Opportunity: Name", group: "Opportunity" },
  { value: "opportunity.totalDebt", label: "Opportunity: Total Debt", group: "Opportunity" },
  { value: "opportunity.programLength", label: "Opportunity: Program Length", group: "Opportunity" },
  { value: "opportunity.monthlyPayment", label: "Opportunity: Monthly Payment", group: "Opportunity" },
  { value: "opportunity.firstPaymentDate", label: "Opportunity: First Payment Date", group: "Opportunity" },
  { value: "opportunity.stage", label: "Opportunity: Stage", group: "Opportunity" },

  // Sender + system
  { value: "user.name", label: "Sender: Name", group: "System" },
  { value: "user.email", label: "Sender: Email", group: "System" },
  { value: "today", label: "Today (YYYY-MM-DD)", group: "System" },
];

export const MERGE_PATH_VALUES: ReadonlySet<string> = new Set(MERGE_PATHS.map((p) => p.value));

export const RECORD_TYPES = [
  "CONTRACT",
  "BANK_CHANGE",
  "DISCLOSURE",
  "AMENDMENT",
  "OTHER",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];
