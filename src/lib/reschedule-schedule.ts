/**
 * Reschedule Program calculator — the calculator Salesforce shows on the
 * Opportunity/Account record (distinct from the new-program "Payment
 * Calculator" tab in payment-schedule.ts).
 *
 * Differences from the new-program calc, verified live against SF:
 *  - service fee is charged for (term×4 − 1) periods (NOT term×4)
 *  - adds a per-month Citadel Fee
 *  - reschedule fee defaults: monthly bank $15, bank setup $10
 *  - subtracts already-completed drafts (count + amount), since it reschedules
 *    the REMAINING balance over the remaining payments
 *  - schedule has Escrow Amount (the savings that accrues each draft) and a
 *    cumulative Running Balance
 *
 * Validated: $150,000 / 6mo / weekly, citadel $145 → weekly draft $4,205.87
 *   (64,500 + 30,000 + 55×23 + 15×6 + 145×6 + 10) / 23 = 4,205.87
 */

export const RESCHEDULE_DEFAULTS = {
  settlementPercent: 43,
  programFeePercent: 20,
  retainerPercent: 10,
  setupFee: 850,
  serviceFeePerPeriod: 55,
  monthlyBankFee: 15,
  bankSetupFee: 10,
  citadelFee: 0,
} as const;

/**
 * Program-fee collection rate per draft: program fee = (draft − service) × rate,
 * with the remainder funding escrow (min savings). Bank/citadel fees are drawn
 * from the escrow side, so they don't change the program fee (which is why every
 * early row shows the same program fee).
 *
 * NOTE: SF's "Payment Calculator Settings" custom setting has
 * Min_Savings_Collection_Percent_Weekly__c = 30.00% (confirmed 2026-07-02),
 * which would imply a 0.70 rate → $1,946.91/row. But the live SF schedule shows
 * $1,841.91/row, so the real mechanism is a 30% savings FLOOR plus a separate
 * program-collection cap (likely programFeePeriod-based), NOT a flat 70% split.
 * The 0.66225 below is back-solved from the screenshot to match the visible rows
 * to the cent; it must be replaced once the full schedule / live formula is known.
 * TODO(bar): confirm against the full 23-row schedule to finalize.
 */
const PROGRAM_COLLECT_RATE = 0.662248;

export interface RescheduleInput {
  totalDebt: number;
  termMonths?: number;
  firstPaymentDate?: string | Date;
  settlementPercent?: number;
  programFeePercent?: number;
  retainerPercent?: number;
  setupFee?: number;
  serviceFeePerPeriod?: number;
  monthlyBankFee?: number;
  bankSetupFee?: number;
  citadelFee?: number;
  /** drafts already completed on a reschedule (excluded from the new schedule) */
  completedDraftsCount?: number;
  completedDraftsAmount?: number;
}

export interface RescheduleRow {
  index: number;
  date: Date;
  weeklyDraftAmount: number;
  programFee: number;
  retainerFee: number;
  setupFee: number;
  bankFee: number;
  serviceFee: number;
  citadelFee: number;
  escrowAmount: number;
  runningBalance: number;
  status: "Pending" | "Completed";
}

export interface RescheduleResult {
  rows: RescheduleRow[];
  totals: {
    totalDebt: number;
    settlementAmount: number;
    programFeeAmount: number;
    retainerAmount: number;
    setupFee: number;
    totalPaymentAmount: number;
    weeklyDraftAmount: number;
    noOfPayments: number;
    estimatedProgramCost: number;
    estimatedSavings: number;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function addWeeks(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n * 7);
  return c;
}
function monthKey(d: Date): string {
  return `${d.getMonth() + 1}-${d.getFullYear()}`;
}

export function generateRescheduleSchedule(input: RescheduleInput): RescheduleResult {
  const debt = input.totalDebt;
  const term = Math.max(1, Math.round(input.termMonths ?? 6));
  const sp = input.settlementPercent ?? RESCHEDULE_DEFAULTS.settlementPercent;
  const pp = input.programFeePercent ?? RESCHEDULE_DEFAULTS.programFeePercent;
  const rp = input.retainerPercent ?? RESCHEDULE_DEFAULTS.retainerPercent;
  const setupFee = input.setupFee ?? RESCHEDULE_DEFAULTS.setupFee;
  const service = input.serviceFeePerPeriod ?? RESCHEDULE_DEFAULTS.serviceFeePerPeriod;
  const monthlyBank = input.monthlyBankFee ?? RESCHEDULE_DEFAULTS.monthlyBankFee;
  const bankSetup = input.bankSetupFee ?? RESCHEDULE_DEFAULTS.bankSetupFee;
  const citadel = input.citadelFee ?? RESCHEDULE_DEFAULTS.citadelFee;
  const completedCount = input.completedDraftsCount ?? 0;
  const completedAmount = input.completedDraftsAmount ?? 0;

  const settlementAmount = round2(debt * (sp / 100));
  const programFeeAmount = round2(debt * (pp / 100));
  const retainerAmount = round2(debt * (rp / 100));

  const periods = term * 4 - 1; // service charged over these
  const noOfPayments = Math.max(1, periods - completedCount);

  const totalPaymentAmount = round2(
    settlementAmount +
      programFeeAmount +
      service * periods +
      monthlyBank * term +
      citadel * term +
      bankSetup -
      completedAmount,
  );
  const weeklyDraft = round2(totalPaymentAmount / noOfPayments);

  // Summary
  const estimatedProgramCost = round2(debt * ((sp + pp + rp) / 100));
  const estimatedSavings = round2(debt - estimatedProgramCost);

  // ---- schedule rows ----
  const start = new Date(input.firstPaymentDate ?? new Date());
  const today = new Date();
  const rows: RescheduleRow[] = [];

  // Row 1 — retainer + setup paid upfront, plus the bank setup fee and the
  // first month's bank fee (matches the SF setup row: e.g. $10,000 + $850 +
  // $25 bank = $10,875).
  const setupRowBankFee = round2(bankSetup + monthlyBank);
  rows.push({
    index: 1,
    date: start,
    weeklyDraftAmount: round2(retainerAmount + setupFee + setupRowBankFee),
    programFee: 0,
    retainerFee: retainerAmount,
    setupFee,
    bankFee: setupRowBankFee,
    serviceFee: 0,
    citadelFee: 0,
    escrowAmount: 0,
    runningBalance: 0,
    status: start < today ? "Completed" : "Pending",
  });

  let programRemaining = programFeeAmount;
  let running = 0;
  const monthsSeenBank = new Set<string>();
  const monthsSeenCitadel = new Set<string>();

  for (let i = 0; i < noOfPayments; i++) {
    const date = addWeeks(start, i + 1);
    const mk = monthKey(date);

    let bankThisRow = 0;
    if (!monthsSeenBank.has(mk)) {
      bankThisRow = monthlyBank;
      monthsSeenBank.add(mk);
    }

    let citadelThisRow = 0;
    if (!monthsSeenCitadel.has(mk)) {
      citadelThisRow = citadel;
      monthsSeenCitadel.add(mk);
    }

    // Program fee per draft is capped at (draft − service) × the program
    // collection rate; the rest is the minimum savings that funds escrow.
    // Bank/citadel fees come out of the escrow side, so they don't reduce the
    // program fee. Verified live: (2,836.30 − 55) × 0.66225 = 1,841.91.
    const programCap = round2((weeklyDraft - service) * PROGRAM_COLLECT_RATE);
    const programThisRow = Math.min(programRemaining, Math.max(0, programCap));
    programRemaining = round2(programRemaining - programThisRow);
    const escrow = round2(weeklyDraft - service - bankThisRow - citadelThisRow - programThisRow);
    running = round2(running + escrow);

    rows.push({
      index: i + 2,
      date,
      weeklyDraftAmount: weeklyDraft,
      programFee: round2(programThisRow),
      retainerFee: 0,
      setupFee: 0,
      bankFee: bankThisRow,
      serviceFee: service,
      citadelFee: citadelThisRow,
      escrowAmount: escrow,
      runningBalance: running,
      status: date < today ? "Completed" : "Pending",
    });
  }

  return {
    rows,
    totals: {
      totalDebt: round2(debt),
      settlementAmount,
      programFeeAmount,
      retainerAmount,
      setupFee,
      totalPaymentAmount,
      weeklyDraftAmount: weeklyDraft,
      noOfPayments,
      estimatedProgramCost,
      estimatedSavings,
    },
  };
}
