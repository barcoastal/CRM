/**
 * Read-time port of SF Opportunity formula fields (DS_*).
 *
 * Source: docs/sf-export/sfdx-raw/objects/Opportunity/fields/DS_*.field-meta.xml
 *         (the SF export bundles these into the sfDataJson snapshot so we
 *         already have the historical values; this module re-computes the
 *         live values from the current CRM data instead of trusting stale
 *         snapshots.)
 *
 * Conventions:
 *  - All amounts are dollars (Float). NaN / Infinity → null.
 *  - "ProgramPlan" inputs are summed across the active plan's drafts, fees
 *    and processor fees the same way SF rolls up Program_Plan__c → Opportunity.
 *  - When inputs are missing we return null instead of 0 so the UI can render
 *    an em-free "—" instead of a misleading $0.
 */

export interface OppFormulaInputs {
  /** Sum of Debt.originalBalance for the Opp (matches SF Total_Debt__c). */
  totalDebt: number;
  /** SF Program_Fee_Percent__c (0-100). */
  programFeePercent: number | null;
  /** SF Program_Fee_Period__c — number of months over which the program fee is collected. */
  programFeePeriodMonths: number | null;
  /** SF Setup_Fee__c. */
  setupFee: number | null;
  /** SF Monthly_Bank_Fee__c. */
  monthlyBankFee: number | null;
  /** SF Service_Fee__c. */
  serviceFee: number | null;
  /** SF Estimated_Settlement_Percent__c (0-100 — typical SF default 50). */
  estimatedSettlementPercent: number | null;
  /** SF Buyout_Fee_Percent__c (0-100). Only meaningful on Buyout opps. */
  buyoutFeePercent: number | null;
  /** SF Buyout_Loan_Amount__c — principal of the buyout loan. */
  buyoutLoanAmount: number | null;
}

export interface OppFormulaOutputs {
  /** DS_Estimated_Settlement__c — what we expect to pay creditors. */
  estimatedSettlement: number | null;
  /** DS_Total_Program_Fee__c — total $ to be collected as program fee. */
  totalProgramFee: number | null;
  /** DS_Total_Bank_Fee__c — totals monthlyBankFee over the program window. */
  totalBankFee: number | null;
  /** DS_Total_Amount_With_Fees__c — what the client pays in total. */
  totalAmountWithFees: number | null;
  /** DS_Buyout_Fee__c — fee charged on the buyout amount. */
  buyoutFee: number | null;
  /** DS_Total_Buyout_Amount__c — buyout principal + buyout fee. */
  totalBuyoutAmount: number | null;
  /** DS_Total_Savings__c — total client saves vs face value. */
  totalSavings: number | null;
  /** DS_Total_Savings_Percent__c — totalSavings / totalDebt * 100. */
  totalSavingsPercent: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const safe = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

export function computeOppFormulas(inputs: OppFormulaInputs): OppFormulaOutputs {
  const debt = safe(inputs.totalDebt) ?? 0;
  const settlementPct = safe(inputs.estimatedSettlementPercent);
  const feePct = safe(inputs.programFeePercent);
  const periodMonths = safe(inputs.programFeePeriodMonths);
  const setup = safe(inputs.setupFee) ?? 0;
  const monthlyBank = safe(inputs.monthlyBankFee) ?? 0;
  const service = safe(inputs.serviceFee) ?? 0;
  const buyoutPct = safe(inputs.buyoutFeePercent);
  const buyoutLoan = safe(inputs.buyoutLoanAmount);

  const estimatedSettlement =
    debt > 0 && settlementPct != null ? round2(debt * (settlementPct / 100)) : null;

  const totalProgramFee =
    debt > 0 && feePct != null ? round2(debt * (feePct / 100)) : null;

  const totalBankFee =
    periodMonths != null && monthlyBank > 0
      ? round2(monthlyBank * periodMonths)
      : null;

  const totalAmountWithFees = (() => {
    if (estimatedSettlement == null && totalProgramFee == null) return null;
    return round2(
      (estimatedSettlement ?? 0) +
        (totalProgramFee ?? 0) +
        setup +
        (totalBankFee ?? 0) +
        service
    );
  })();

  const buyoutFee =
    buyoutLoan != null && buyoutPct != null
      ? round2(buyoutLoan * (buyoutPct / 100))
      : null;

  const totalBuyoutAmount =
    buyoutLoan != null
      ? round2(buyoutLoan + (buyoutFee ?? 0))
      : null;

  const totalSavings =
    estimatedSettlement != null && debt > 0
      ? round2(debt - estimatedSettlement)
      : null;

  const totalSavingsPercent =
    totalSavings != null && debt > 0
      ? round2((totalSavings / debt) * 100)
      : null;

  return {
    estimatedSettlement,
    totalProgramFee,
    totalBankFee,
    totalAmountWithFees,
    buyoutFee,
    totalBuyoutAmount,
    totalSavings,
    totalSavingsPercent,
  };
}

/** Pretty-format helper. Returns null when the value isn't finite. */
export function fmtMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtPercent(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(2)}%`;
}
