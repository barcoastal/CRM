/**
 * Payment Schedule Generator — Coastal Debt / SF "Business Lead" formula.
 *
 * Reverse-engineered from the SF Payment Calculator Lightning app on
 * 2026-06-03 by feeding $50K and $100K through Term=6 and confirming the
 * outputs are exact to the cent.
 *
 * Locked defaults (the SF UI grays them out — only Total Debt + Term are
 * user-editable in Business Lead mode):
 *   Settlement %       = 43
 *   Program Fee %      = 20
 *   Retainer %         = 10
 *   Setup Fee          = $850 (one-time, paid in Setup Row)
 *   Service Fee        = $55 / period
 *   Monthly Bank Fee   = $10 / month
 *   Bank Setup Fee     = $15 (one-time)
 *   Payment Frequency  = Weekly
 *
 * Schedule shape:
 *   Row 1 (Setup Row):   Setup Fee + Retainer = $850 + Debt × 10%
 *   Rows 2..N (Weekly):  constant $W each, where N = Term × 4 - 1
 *
 * Aggregate totals:
 *   Total Settlement      = Debt × 43%
 *   Total Program Fee     = Debt × 20%
 *   Total Retainer        = Debt × 10%
 *   Total Amount With Fees = Debt × 73%
 *   Estimated You Save    = Debt × 27%
 *   Total Cost            = Debt × 73% + $865 + $230 × Term
 *   Weekly Payment        = (Debt × 63% + $15 + $230 × Term) / (Term × 4 − 1)
 */

export type Frequency = "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "DAILY";

/** SF Business Lead defaults — locked in the canonical calculator */
export const SF_DEFAULTS = {
  settlementPercent: 43,
  programFeePercent: 20,
  retainerPercent: 10,
  setupFee: 850,
  serviceFeePerPeriod: 55,
  monthlyBankFee: 10,
  bankSetupFee: 15,
  frequency: "WEEKLY" as Frequency,
} as const;

export interface PaymentScheduleInput {
  /** Total debt to settle */
  totalDebt: number;
  /** Program term in MONTHS (1–30 in SF). Defaults to 6. */
  termMonths?: number;
  /** Frequency — only WEEKLY is supported by SF Business Lead mode. */
  frequency?: Frequency;
  /** First payment date for the schedule */
  firstPaymentDate?: string | Date;
  /** Optional overrides — pass to change the locked SF defaults */
  settlementPercent?: number;
  programFeePercent?: number;
  retainerPercent?: number;
  setupFee?: number;
  serviceFeePerPeriod?: number;
  monthlyBankFee?: number;
  bankSetupFee?: number;
}

export interface PaymentRow {
  index: number;
  date: Date;
  weeklyPaymentAmount: number;
  setupFee: number;
  weeklyProgramFee: number;
  weeklyServiceFee: number;
  monthlyBankFee: number;
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
    totalAmountWithFees: number;        // labeled "(73%)"
    totalAmountWithFeesPercent: number; // e.g. 73
    estimatedAmountYouSave: number;     // labeled "(27%)"
    estimatedAmountYouSavePercent: number;
    weeklyPayments: number;
    totalCost: number;
    setupRowAmount: number;
    weeklyRows: number;                  // count of weekly rows
    totalRows: number;                   // 1 setup + weeklyRows
    weeklyServiceFee: number;            // per-week display value
    monthlyBankFee: number;
    bankSetupFee: number;
    setupFee: number;
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

/** Number of months between two weekly payments — used for the "Monthly Bank Fee" column display. */
function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

export function generatePaymentSchedule(input: PaymentScheduleInput): PaymentScheduleResult {
  const debt = input.totalDebt;
  const termMonths = Math.max(1, Math.round(input.termMonths ?? 6));
  const sp = input.settlementPercent ?? SF_DEFAULTS.settlementPercent;
  const pp = input.programFeePercent ?? SF_DEFAULTS.programFeePercent;
  const rp = input.retainerPercent ?? SF_DEFAULTS.retainerPercent;
  const setupFee = input.setupFee ?? SF_DEFAULTS.setupFee;
  const servicePerPeriod = input.serviceFeePerPeriod ?? SF_DEFAULTS.serviceFeePerPeriod;
  const monthlyBankFee = input.monthlyBankFee ?? SF_DEFAULTS.monthlyBankFee;
  const bankSetupFee = input.bankSetupFee ?? SF_DEFAULTS.bankSetupFee;

  // ============ Aggregate totals ============
  const totalSettlementAmt = round2(debt * (sp / 100));
  const totalProgramFee = round2(debt * (pp / 100));
  const retainerAmount = round2(debt * (rp / 100));
  const totalWithFeesPercent = sp + pp + rp; // = 73
  const totalAmountWithFees = round2(debt * (totalWithFeesPercent / 100));
  const estimatedAmountYouSavePercent = round2(100 - totalWithFeesPercent);
  const estimatedAmountYouSave = round2(debt * (estimatedAmountYouSavePercent / 100));

  const totalRows = termMonths * 4;          // monthly × 4 weeks
  const weeklyRows = totalRows - 1;          // setup row replaces "week 1"
  const totalCost = round2(
    totalSettlementAmt +
      totalProgramFee +
      setupFee +
      retainerAmount +
      servicePerPeriod * totalRows +
      monthlyBankFee * termMonths +
      bankSetupFee
  );
  const setupRowAmount = round2(setupFee + retainerAmount);
  const weeklyPayments = round2((totalCost - setupRowAmount) / weeklyRows);

  // ============ Per-row schedule ============
  const startDate = new Date(input.firstPaymentDate ?? new Date());
  const rows: PaymentRow[] = [];
  const today = new Date();

  // Row 1: setup row (Setup Fee + Retainer)
  rows.push({
    index: 1,
    date: startDate,
    weeklyPaymentAmount: setupRowAmount,
    setupFee: setupFee,
    weeklyProgramFee: 0,
    weeklyServiceFee: 0,
    monthlyBankFee: 0,
    weeklySavings: 0,
    status: startDate < today ? "Completed" : "Pending",
  });

  // Weekly Program Fee allocation: program fee paid first weeks until exhausted,
  // then $0 (and that bucket flows to weekly savings).
  // Per-week split inside $weeklyPayments:
  //   serviceFee = $55 fixed
  //   programFee = whatever's left of total program fee, capped at (weeklyPayments - serviceFee - amortizedBank)
  //   savings    = remainder
  let programRemaining = totalProgramFee;
  // The amortized bank component embedded in weekly payments:
  //   weekly bank component = (monthlyBank × termMonths + bankSetup) / weeklyRows
  const bankAmortized = round2((monthlyBankFee * termMonths + bankSetupFee) / weeklyRows);
  const targetProgramPlusSavings = round2(weeklyPayments - servicePerPeriod - bankAmortized);

  for (let i = 1; i <= weeklyRows; i++) {
    const date = addWeeks(startDate, i);
    // Display value for Monthly Bank Fee column:
    //  - week 1 (i=1): bankSetup + monthlyBank = $25
    //  - every ~4 weeks after: monthlyBank = $10
    //  - others: $0
    let displayBank = 0;
    if (i === 1) {
      displayBank = bankSetupFee + monthlyBankFee;
    } else {
      // Charge monthly bank fee every 4 weeks (week 5, 9, 13, ...)
      const sinceFirst = i - 1;
      if (sinceFirst % 4 === 0) {
        displayBank = monthlyBankFee;
      }
    }

    // Program fee for this week — pay as much as possible until exhausted
    const programThisWeek = Math.min(programRemaining, targetProgramPlusSavings);
    programRemaining = round2(programRemaining - programThisWeek);
    const savingsThisWeek = round2(targetProgramPlusSavings - programThisWeek);

    rows.push({
      index: i + 1,
      date,
      weeklyPaymentAmount: weeklyPayments,
      setupFee: 0,
      weeklyProgramFee: round2(programThisWeek),
      weeklyServiceFee: servicePerPeriod,
      monthlyBankFee: displayBank,
      weeklySavings: savingsThisWeek,
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
      totalSettlementAmt,
      totalProgramFee,
      retainerAmount,
      totalAmountWithFees,
      totalAmountWithFeesPercent: totalWithFeesPercent,
      estimatedAmountYouSave,
      estimatedAmountYouSavePercent,
      weeklyPayments,
      totalCost,
      setupRowAmount,
      weeklyRows,
      totalRows,
      weeklyServiceFee: servicePerPeriod,
      monthlyBankFee,
      bankSetupFee,
      setupFee,
    },
  };
}
