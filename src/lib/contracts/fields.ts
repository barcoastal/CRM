/**
 * Catalog of CRM merge fields available in a contract template. The Word editor
 * renders these as an "Insert CRM field" palette; buildContractData() must
 * return a value for every scalar `token` and an array for every table `token`.
 * One source of truth so the editor and the merge never drift.
 */
export interface ScalarField {
  token: string; // e.g. "ClientName" -> inserted as {{ClientName}}
  label: string;
  group: string;
}

export interface TableColumn {
  token: string; // loop-item token, e.g. "Date"
  label: string;
}
export interface TableField {
  token: string; // loop token, e.g. "Schedule" -> {{#Schedule}}…{{/Schedule}}
  label: string;
  columns: TableColumn[];
}

export const SCALAR_FIELDS: ScalarField[] = [
  // Business / client
  { token: "ClientName", label: "Business / client name", group: "Business" },
  { token: "ClientAddress", label: "Street address", group: "Business" },
  { token: "ClientCity", label: "City", group: "Business" },
  { token: "ClientState", label: "State", group: "Business" },
  { token: "ClientZip", label: "ZIP", group: "Business" },
  { token: "ClientPhone", label: "Phone", group: "Business" },
  { token: "ClientEmail", label: "Email", group: "Business" },
  // Program / payment structure
  { token: "TotalDebt", label: "Total enrolled debt", group: "Program" },
  { token: "ProgramLength", label: "Program length (months)", group: "Program" },
  { token: "FirstPaymentDate", label: "First payment date", group: "Program" },
  { token: "FirstPaymentAmount", label: "First payment amount", group: "Program" },
  { token: "WeeklyPayment", label: "Weekly payment (ongoing)", group: "Program" },
  { token: "RetainerAmount", label: "Retainer amount", group: "Program" },
  { token: "SetupFee", label: "Setup fee", group: "Program" },
  { token: "ServiceFee", label: "Service fee", group: "Program" },
  { token: "TotalWithFees", label: "Total of all payments", group: "Program" },
  { token: "EstimatedSavings", label: "Estimated savings", group: "Program" },
  { token: "SettlementPercent", label: "Settlement %", group: "Program" },
  { token: "ProgramFeePercent", label: "Program fee %", group: "Program" },
  { token: "ProcessorName", label: "Payment processor (SAS/RAM)", group: "Program" },
  { token: "TodayDate", label: "Today's date", group: "General" },
  // Signer / contact details (SAS client block)
  { token: "ContactFirstName", label: "Signer first name", group: "Signer" },
  { token: "ContactLastName", label: "Signer last name", group: "Signer" },
  { token: "ContactTitle", label: "Signer title", group: "Signer" },
  { token: "ContactDOB", label: "Signer date of birth", group: "Signer" },
  { token: "ContactHomePhone", label: "Home phone", group: "Signer" },
  { token: "ContactCellPhone", label: "Cell phone", group: "Signer" },
  // Bank (ACH debit authorization)
  { token: "BankName", label: "Bank name", group: "Bank" },
  { token: "BankRoutingNumber", label: "Routing number", group: "Bank" },
  { token: "BankAccountNumber", label: "Account number", group: "Bank" },
  { token: "BankAccountType", label: "Account type (Checking/Savings)", group: "Bank" },
  { token: "BankIsChecking", label: "Checking checkbox (X)", group: "Bank" },
  { token: "BankIsSavings", label: "Savings checkbox (X)", group: "Bank" },
];

export const TABLE_FIELDS: TableField[] = [
  {
    token: "Creditors",
    label: "Enrolled creditors",
    columns: [
      { token: "CreditorName", label: "Creditor" },
      { token: "Balance", label: "Balance" },
      { token: "AccountNumber", label: "Account #" },
    ],
  },
  {
    token: "Schedule",
    label: "Payment schedule",
    columns: [
      { token: "Date", label: "Date" },
      { token: "Amount", label: "Payment" },
      { token: "RetainerFee", label: "Retainer" },
      { token: "ProgramFee", label: "Program" },
      { token: "SetupFee", label: "Setup" },
      { token: "ServiceFee", label: "Service" },
      { token: "BankFee", label: "Bank" },
      { token: "LegalPlanFee", label: "Legal Plan" },
      { token: "SettlementAccount", label: "Settlement" },
    ],
  },
  {
    token: "DebitSchedule",
    label: "ACH debit schedule",
    columns: [
      { token: "DepositAmount", label: "Amount" },
      { token: "StartDate", label: "Start date" },
      { token: "NumberOfPayments", label: "# of payments" },
    ],
  },
];

/**
 * Build an HTML table for a loop field, with docxtemplater loop tokens so the
 * row repeats per record. Open tag goes in the first cell, close in the last.
 */
export function tableFieldHtml(field: TableField): string {
  const headers = field.columns.map((c) => `<td><strong>${c.label}</strong></td>`).join("");
  const bodyCells = field.columns
    .map((c, i) => {
      const open = i === 0 ? `{{#${field.token}}}` : "";
      const close = i === field.columns.length - 1 ? `{{/${field.token}}}` : "";
      return `<td>${open}{{${c.token}}}${close}</td>`;
    })
    .join("");
  return `<table border="1" cellspacing="0" cellpadding="4"><tbody><tr>${headers}</tr><tr>${bodyCells}</tr></tbody></table>`;
}
