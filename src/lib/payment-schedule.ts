/**
 * Payment Schedule Generator — EXACT port of Salesforce's Apex calculator.
 *
 * Source: docs/sf-export/sfdx-raw/classes/PaymentCalculatorElements.cls
 * and    docs/sf-export/sfdx-raw/classes/PaymentCalculator.cls
 *
 * Canonical Apex formula:
 *   totalPaymentAmount = settlementAmount
 *                      + programFeeAmount
 *                      + (serviceFee × (paymentTerm × 4))
 *                      + (monthlyBankFee × paymentTerm)
 *                      + (citadelFee × paymentTerm)
 *                      + (citadelFee × additionalMonthForCitadelFee)
 *                      + bankSetupFee
 *                      − completedDraftsAmount
 *
 *   newTotalDebt = totalPaymentAmount + retainerAmount + setupFee
 *
 *   noOfActualPayments = (paymentTerm × 4) − 1   // weekly rows
 *   weeklyPayment      = totalPaymentAmount / (noOfActualPayments − completedDraftsCount)
 *
 *   settlementAmount = totalDebt × (settlementPercent / 100)
 *   programFeeAmount = totalDebt × (programFeePercent / 100)
 *   retainerAmount   = totalDebt × (retainerPercent / 100)
 *
 * Setup Row schedule:
 *   Row 1 (paid upfront)      = setupFee + retainerAmount
 *   Rows 2..N (weekly)        = weeklyPayment each, N = noOfActualPayments
 *
 * Per-row breakdown (matches the SF UI grid):
 *   Setup Fee column:    setupFee on Row 1, $0 thereafter
 *   Service Fee column:  serviceFee each weekly row (display only)
 *   Bank Fee column:     bankSetupFee + monthlyBankFee on Row 2; monthlyBankFee
 *                        every 4th week thereafter (matches monthYear cycle)
 *   Program Fee column:  fills until totalProgramFee is exhausted
 *   Citadel Fee column:  citadelFee once per monthYear bucket
 *   Savings column:      remainder
 */

export type Frequency = "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "DAILY";

/** SF Business Lead defaults — locked picklists in the standalone calculator */
export const SF_DEFAULTS = {
  settlementPercent: 43,
  programFeePercent: 20,
  retainerPercent: 10,
  setupFee: 850,
  serviceFeePerPeriod: 55,
  monthlyBankFee: 15,
  bankSetupFee: 10,
  // Monthly legal fee (Citadel legal plan). Charged once per month; standard $145.
  citadelFee: 145,
  additionalMonthForCitadelFee: 0,
  frequency: "WEEKLY" as Frequency,
} as const;

/**
 * Setup fee mirrors SF's `SetupFee__mdt` table: $850 without a legal plan,
 * $995 when a legal plan is required (same for both Citadel and Victory Legal
 * Plan network types — only the Legal_Plan_Required__c flag changes the fee).
 * Source: SetupFee__mdt records in the coastal org (queried 2026-06-23).
 */
export const SETUP_FEE_NO_LEGAL_PLAN = 850;
export const SETUP_FEE_WITH_LEGAL_PLAN = 995;

export function resolveSetupFee(legalPlanRequired?: boolean | null): number {
  return legalPlanRequired ? SETUP_FEE_WITH_LEGAL_PLAN : SETUP_FEE_NO_LEGAL_PLAN;
}

export interface PaymentScheduleInput {
  totalDebt: number;
  termMonths?: number;
  frequency?: Frequency;
  firstPaymentDate?: string | Date;
  /** Drives setup fee ($995 if true, else $850) when setupFee isn't given. */
  legalPlanRequired?: boolean;
  // overrides for defaults
  settlementPercent?: number;
  programFeePercent?: number;
  retainerPercent?: number;
  setupFee?: number;
  serviceFeePerPeriod?: number;
  monthlyBankFee?: number;
  bankSetupFee?: number;
  citadelFee?: number;
  additionalMonthForCitadelFee?: number;
  completedDraftsCount?: number;
  completedDraftsAmount?: number;
}

export interface PaymentRow {
  index: number;
  date: Date;
  weeklyPaymentAmount: number;
  setupFee: number;
  weeklyProgramFee: number;
  weeklyServiceFee: number;
  monthlyBankFee: number;
  citadelFee: number;
  weeklySavings: number;
  status: "Pending" | "Completed";
}

export interface PaymentScheduleResult {
  rows: PaymentRow[];
  totals: {
    totalDebt: number;
    settlementPercent: number;
    programFeePercent: number;
    retainerPercent: number;
    totalSettlementAmt: number;
    totalProgramFee: number;
    retainerAmount: number;
    totalAmountWithFees: number;
    totalAmountWithFeesPercent: number;
    estimatedAmountYouSave: number;
    estimatedAmountYouSavePercent: number;
    weeklyPayments: number;
    totalPaymentAmount: number;       // Apex: totalPaymentAmount
    newTotalDebtAmount: number;       // Apex: getNewTotalDebtAmount()
    setupRowAmount: number;
    weeklyRows: number;
    totalRows: number;
    setupFee: number;
    weeklyServiceFee: number;
    monthlyBankFee: number;
    bankSetupFee: number;
    citadelFee: number;
    additionalMonthForCitadelFee: number;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addWeeks(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

function monthYearKey(d: Date): string {
  return `${d.getMonth() + 1}-${d.getFullYear()}`;
}

export function generatePaymentSchedule(input: PaymentScheduleInput): PaymentScheduleResult {
  const debt = input.totalDebt;
  const term = Math.max(1, Math.round(input.termMonths ?? 6));
  const sp = input.settlementPercent ?? SF_DEFAULTS.settlementPercent;
  const pp = input.programFeePercent ?? SF_DEFAULTS.programFeePercent;
  const rp = input.retainerPercent ?? SF_DEFAULTS.retainerPercent;
  const setupFee = input.setupFee ?? resolveSetupFee(input.legalPlanRequired);
  const servicePerPeriod = input.serviceFeePerPeriod ?? SF_DEFAULTS.serviceFeePerPeriod;
  const monthlyBankFee = input.monthlyBankFee ?? SF_DEFAULTS.monthlyBankFee;
  const bankSetupFee = input.bankSetupFee ?? SF_DEFAULTS.bankSetupFee;
  const citadelFee = input.citadelFee ?? SF_DEFAULTS.citadelFee;
  const additionalMonthForCitadelFee =
    input.additionalMonthForCitadelFee ?? SF_DEFAULTS.additionalMonthForCitadelFee;
  const completedDraftsCount = input.completedDraftsCount ?? 0;
  const completedDraftsAmount = input.completedDraftsAmount ?? 0;

  // ============ Apex: settlement / program / retainer ============
  const settlementAmount = round2(debt * (sp / 100));
  const programFeeAmount = round2(debt * (pp / 100));
  const retainerAmount = round2(debt * (rp / 100));

  // ============ Apex: noOfActualPayments + totalPaymentAmount ============
  const noOfActualPayments = term * 4 - 1; // weekly rows
  const totalPaymentAmount = round2(
    settlementAmount +
      programFeeAmount +
      // Service fee is charged once per weekly payment row: (term × 4) − 1.
      // This is the exact Apex formula in PaymentCalculatorElements
      // .getTotalPaymentAmount() (serviceFee × ((paymentTerm × 4) − 1)).
      // Verified live 2026-07-02: $100k/6mo/SAS → weekly draft $2,836.30.
      servicePerPeriod * noOfActualPayments +
      monthlyBankFee * term +
      citadelFee * term +
      citadelFee * additionalMonthForCitadelFee +
      bankSetupFee -
      completedDraftsAmount
  );
  const newTotalDebtAmount = round2(totalPaymentAmount + retainerAmount + setupFee);

  // ============ Apex: getTotalAmountPerMonth (= weekly payment) ============
  const divisor = Math.max(1, noOfActualPayments - completedDraftsCount);
  const weeklyPayment = round2(totalPaymentAmount / divisor);

  // ============ Display totals (UI summary fields) ============
  const totalWithFeesPercent = sp + pp + rp;
  const totalAmountWithFees = round2(debt * (totalWithFeesPercent / 100));
  const estimatedSavePercent = round2(100 - totalWithFeesPercent);
  const estimatedAmountYouSave = round2(debt * (estimatedSavePercent / 100));
  // The upfront setup/retainer draft also carries the bank setup fee plus the
  // first month's bank fee, matching the SF setup row (e.g. $10,000 retainer +
  // $850 setup + $25 bank = $10,875).
  const setupRowBankFee = round2(bankSetupFee + monthlyBankFee);
  const setupRowAmount = round2(setupFee + retainerAmount + setupRowBankFee);

  // ============ Per-row schedule generation ============
  const startDate = new Date(input.firstPaymentDate ?? new Date());
  const today = new Date();
  const rows: PaymentRow[] = [];

  // Row 1 — Setup Row (paid upfront, Setup + Retainer)
  rows.push({
    index: 1,
    date: startDate,
    weeklyPaymentAmount: setupRowAmount,
    setupFee: setupFee,
    weeklyProgramFee: 0,
    weeklyServiceFee: 0,
    monthlyBankFee: setupRowBankFee,
    citadelFee: 0,
    weeklySavings: 0,
    status: startDate < today ? "Completed" : "Pending",
  });

  // Per-row breakdown state (mirrors Apex monthYearNoOfPaymentsMap)
  let programRemaining = programFeeAmount;
  const monthsSeenForBank = new Set<string>();
  const monthsSeenForCitadel = new Set<string>();

  for (let i = 0; i < noOfActualPayments; i++) {
    const date = addWeeks(startDate, i + 1);
    const monthKey = monthYearKey(date);

    // Monthly bank fee on the first weekly row of each new month. The bank
    // setup fee and the first month's bank fee are carried on the setup row.
    let bankFeeThisRow = 0;
    if (!monthsSeenForBank.has(monthKey)) {
      bankFeeThisRow = monthlyBankFee;
      monthsSeenForBank.add(monthKey);
    }

    // Citadel fee once per month
    let citadelThisRow = 0;
    if (!monthsSeenForCitadel.has(monthKey)) {
      citadelThisRow = citadelFee;
      monthsSeenForCitadel.add(monthKey);
    }

    // Program fee fills until exhausted, capped by available room in weeklyPayment
    const roomForProgramAndSavings = round2(
      weeklyPayment - servicePerPeriod - bankFeeThisRow - citadelThisRow
    );
    const programThisRow = Math.min(programRemaining, Math.max(0, roomForProgramAndSavings));
    programRemaining = round2(programRemaining - programThisRow);
    const savingsThisRow = round2(roomForProgramAndSavings - programThisRow);

    rows.push({
      index: i + 2,
      date,
      weeklyPaymentAmount: weeklyPayment,
      setupFee: 0,
      weeklyProgramFee: round2(programThisRow),
      weeklyServiceFee: servicePerPeriod,
      monthlyBankFee: bankFeeThisRow,
      citadelFee: citadelThisRow,
      weeklySavings: savingsThisRow,
      status: date < today ? "Completed" : "Pending",
    });
  }

  return {
    rows,
    totals: {
      totalDebt: round2(debt),
      settlementPercent: sp,
      programFeePercent: pp,
      retainerPercent: rp,
      totalSettlementAmt: settlementAmount,
      totalProgramFee: programFeeAmount,
      retainerAmount,
      totalAmountWithFees,
      totalAmountWithFeesPercent: totalWithFeesPercent,
      estimatedAmountYouSave,
      estimatedAmountYouSavePercent: estimatedSavePercent,
      weeklyPayments: weeklyPayment,
      totalPaymentAmount,
      newTotalDebtAmount,
      setupRowAmount,
      weeklyRows: noOfActualPayments,
      totalRows: noOfActualPayments + 1,
      setupFee,
      weeklyServiceFee: servicePerPeriod,
      monthlyBankFee,
      bankSetupFee,
      citadelFee,
      additionalMonthForCitadelFee,
    },
  };
}
