/**
 * Payment Schedule Generator — Coastal Debt formula.
 *
 * Each weekly draft is allocated in this order:
 *   1. Setup Fee (first weeks, until full setup is collected)
 *   2. Retained Fee (next weeks, until retainer % of program fee is collected)
 *   3. Program Fee + Escrow (parallel, weighted by their remaining balance)
 *
 * Service Fee, Bank Fee, and Citadel Fee are skimmed every payment regardless.
 *
 * The weekly draft amount is computed so the program completes exactly in
 * `paymentTerm` periods (so weekly draft × periods covers all fees + escrow).
 */

export type Frequency = "DAILY" | "WEEKLY" | "BI_WEEKLY" | "MONTHLY";

export interface PaymentScheduleInput {
  totalDebt: number;
  settlementPercent: number;     // 0–100 — % of debt to settle for
  programFeePercent: number;     // 0–100 — % of debt charged as program fee
  retainerPercent: number;       // 0–100 — % of program fee paid up front as retained fee
  setupFee: number;              // one-time, paid first weeks
  serviceFeePerPeriod: number;   // recurring, every period
  bankFeePerPeriod: number;      // recurring, every period
  citadelFeePerPeriod: number;   // recurring legal-protection fee, every period
  paymentTerm: number;           // total number of periods
  frequency: Frequency;
  firstPaymentDate: string | Date;
}

export interface PaymentRow {
  index: number;
  date: Date;
  weeklyDraftAmount: number;
  programFee: number;
  retainedFee: number;
  setupFee: number;
  bankFee: number;
  serviceFee: number;
  citadelFee: number;
  escrowAmount: number;
  runningBalance: number;   // cumulative escrow balance
  status: "Pending" | "Scheduled" | "Completed";
}

export interface PaymentScheduleResult {
  rows: PaymentRow[];
  totals: {
    programLength: number;        // periods
    totalDebt: number;
    totalSettlement: number;      // target $ to settle for
    totalProgramFee: number;
    totalRetainedFee: number;
    totalSetupFee: number;
    totalBankFee: number;
    totalServiceFee: number;
    totalCitadelFee: number;
    totalEscrowAmount: number;
    totalProgramCost: number;     // grand total of all weekly drafts
    estimatedAmountYouSave: number; // totalDebt - totalSettlement - totalProgramFee
    totalWeeklyPayment: number;   // = mean weekly draft
    totalWeeklySaving: number;    // weekly portion of estimated savings
    totalProcessorFee: number;    // bank + citadel + service (alias)
    totalRetainerPaymentCost: number; // alias for retained fee total
  };
}

function addPeriod(date: Date, frequency: Frequency, n: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + n);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + n * 7);
      break;
    case "BI_WEEKLY":
      d.setDate(d.getDate() + n * 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + n);
      break;
  }
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generatePaymentSchedule(input: PaymentScheduleInput): PaymentScheduleResult {
  const {
    totalDebt,
    settlementPercent,
    programFeePercent,
    retainerPercent,
    setupFee,
    serviceFeePerPeriod,
    bankFeePerPeriod,
    citadelFeePerPeriod,
    paymentTerm,
    frequency,
    firstPaymentDate,
  } = input;

  const term = Math.max(1, Math.round(paymentTerm));
  const totalSettlement = round2(totalDebt * (settlementPercent / 100));
  const totalProgramFee = round2(totalDebt * (programFeePercent / 100));
  const totalRetainedFee = round2(totalProgramFee * (retainerPercent / 100));
  const totalSetupFee = round2(setupFee);
  const recurringPerPeriod = serviceFeePerPeriod + bankFeePerPeriod + citadelFeePerPeriod;
  const totalServiceFee = round2(serviceFeePerPeriod * term);
  const totalBankFee = round2(bankFeePerPeriod * term);
  const totalCitadelFee = round2(citadelFeePerPeriod * term);

  // Total $ that must come out of the program: settlement (→ escrow) + fees
  // (escrow is filled from "Program + Escrow" bucket which equals settlement)
  const totalEscrowAmount = totalSettlement;
  const buildupBuckets = totalSetupFee + totalRetainedFee + totalProgramFee + totalEscrowAmount;
  const totalRecurring = recurringPerPeriod * term;
  const totalProgramCost = round2(buildupBuckets + totalRecurring);
  const baseWeeklyDraft = round2(totalProgramCost / term);

  // Allocation state
  let setupRemaining = totalSetupFee;
  let retainedRemaining = totalRetainedFee;
  let programRemaining = totalProgramFee;
  let escrowRemaining = totalEscrowAmount;
  let runningEscrow = 0;

  const startDate = new Date(firstPaymentDate);
  const rows: PaymentRow[] = [];
  const today = new Date();

  for (let i = 0; i < term; i++) {
    const date = addPeriod(startDate, frequency, i);
    const isLast = i === term - 1;

    // Each row pays recurring fees first, then allocates the rest to buildup
    // buckets in priority order. On the last row we top up rounding remainder.
    const periodDraft = baseWeeklyDraft;
    let buildupBudget = round2(periodDraft - recurringPerPeriod);

    if (isLast) {
      // ensure last row clears all remaining buckets exactly
      buildupBudget = round2(setupRemaining + retainedRemaining + programRemaining + escrowRemaining);
    }

    // 1) Setup
    let setupThisRow = 0;
    if (setupRemaining > 0 && buildupBudget > 0) {
      setupThisRow = round2(Math.min(setupRemaining, buildupBudget));
      setupRemaining = round2(setupRemaining - setupThisRow);
      buildupBudget = round2(buildupBudget - setupThisRow);
    }

    // 2) Retained
    let retainedThisRow = 0;
    if (retainedRemaining > 0 && buildupBudget > 0) {
      retainedThisRow = round2(Math.min(retainedRemaining, buildupBudget));
      retainedRemaining = round2(retainedRemaining - retainedThisRow);
      buildupBudget = round2(buildupBudget - retainedThisRow);
    }

    // 3) Program + Escrow in parallel, weighted by remaining balance
    let programThisRow = 0;
    let escrowThisRow = 0;
    if (buildupBudget > 0 && (programRemaining > 0 || escrowRemaining > 0)) {
      const totalRemaining = programRemaining + escrowRemaining;
      if (totalRemaining > 0) {
        const programShare = (programRemaining / totalRemaining) * buildupBudget;
        const escrowShare = (escrowRemaining / totalRemaining) * buildupBudget;
        programThisRow = round2(Math.min(programRemaining, programShare));
        escrowThisRow = round2(Math.min(escrowRemaining, escrowShare));
        programRemaining = round2(programRemaining - programThisRow);
        escrowRemaining = round2(escrowRemaining - escrowThisRow);
        buildupBudget = round2(buildupBudget - programThisRow - escrowThisRow);
        // any rounding leftover → escrow
        if (buildupBudget > 0) {
          escrowThisRow = round2(escrowThisRow + buildupBudget);
        }
      }
    }

    runningEscrow = round2(runningEscrow + escrowThisRow);

    const actualDraft = round2(
      setupThisRow +
        retainedThisRow +
        programThisRow +
        escrowThisRow +
        recurringPerPeriod
    );

    rows.push({
      index: i + 1,
      date,
      weeklyDraftAmount: actualDraft,
      programFee: programThisRow,
      retainedFee: retainedThisRow,
      setupFee: setupThisRow,
      bankFee: bankFeePerPeriod,
      serviceFee: serviceFeePerPeriod,
      citadelFee: citadelFeePerPeriod,
      escrowAmount: escrowThisRow,
      runningBalance: runningEscrow,
      status: date < today ? "Completed" : "Pending",
    });
  }

  const actualTotalDraft = round2(rows.reduce((s, r) => s + r.weeklyDraftAmount, 0));
  const estimatedAmountYouSave = round2(totalDebt - totalSettlement - totalProgramFee - totalSetupFee);

  return {
    rows,
    totals: {
      programLength: term,
      totalDebt: round2(totalDebt),
      totalSettlement,
      totalProgramFee,
      totalRetainedFee,
      totalSetupFee,
      totalBankFee,
      totalServiceFee,
      totalCitadelFee,
      totalEscrowAmount,
      totalProgramCost: actualTotalDraft,
      estimatedAmountYouSave,
      totalWeeklyPayment: round2(actualTotalDraft / term),
      totalWeeklySaving: round2(estimatedAmountYouSave / term),
      totalProcessorFee: round2(totalBankFee + totalCitadelFee + totalServiceFee),
      totalRetainerPaymentCost: totalRetainedFee,
    },
  };
}
