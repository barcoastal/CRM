/**
 * Builds the token/table data for a deal's contract packet. Scalars come from
 * the opportunity + account; the payment-schedule and debit-schedule come from
 * the SAME engine as the on-screen calculator (generateRescheduleSchedule), so
 * the contract's numbers match the calculator exactly.
 */
import { prisma } from "@/lib/prisma";
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";
import type { MergeData } from "./docx-merge";

const RESCHED = { settlementPercent: 43, programFeePercent: 20, retainerPercent: 10 };

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function mdY(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export async function buildContractData(opportunityId: string): Promise<MergeData> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { account: true, primaryContact: true, debts: true, paymentCalculations: { orderBy: { savedAt: "desc" }, take: 1 } },
  });
  if (!opp) throw new Error("Opportunity not found");
  const acct = opp.account;
  const latestCalc = opp.paymentCalculations[0];

  // Deal parameters (same sourcing as the opportunity page's calculator).
  const totalDebt = latestCalc?.totalDebt ?? opp.totalDebt ?? opp.debts.reduce((s, d) => s + (d.originalBalance ?? 0), 0);
  const term = latestCalc?.programFeePeriod || 6;
  const citadel = latestCalc?.citadelFee ?? 145;
  const firstPaymentDate = acct?.programStartDate ?? opp.firstDraftDate ?? new Date();

  // Feed EVERY saved calculator input into the same engine so the contract's
  // payment structure matches the opportunity to the cent. Undefined values
  // fall back to the calculator's own defaults inside generateRescheduleSchedule.
  const sched = generateRescheduleSchedule({
    totalDebt,
    termMonths: term,
    citadelFee: citadel,
    firstPaymentDate: firstPaymentDate.toISOString().slice(0, 10),
    settlementPercent: latestCalc?.settlementPercentage ?? undefined,
    programFeePercent: latestCalc?.programFeePercent ?? undefined,
    retainerPercent: latestCalc?.retainerPercentage ?? undefined,
    setupFee: latestCalc?.setupFee ?? undefined,
    serviceFeePerPeriod: latestCalc?.serviceFee ?? undefined,
    monthlyBankFee: latestCalc?.monthlyBankFee ?? undefined,
  });
  const t = sched.totals;

  // Payment schedule rows (Legal Plan Fee = citadel column).
  const Schedule = sched.rows.map((r) => ({
    Date: mdY(r.date),
    Amount: usd(r.weeklyDraftAmount),
    RetainerFee: usd(r.retainerFee),
    ProgramFee: usd(r.programFee),
    SetupFee: usd(r.setupFee),
    ServiceFee: usd(r.serviceFee),
    BankFee: usd(r.bankFee),
    LegalPlanFee: usd(r.citadelFee),
    SettlementAccount: usd(r.escrowAmount),
  }));

  // Enrolled debts.
  const Creditors = opp.debts.map((d) => ({
    CreditorName: d.creditorName ?? "",
    Balance: usd(d.originalBalance ?? 0),
    AccountNumber: d.accountNumber ?? "TBD",
  }));

  // Debit schedule (group consecutive equal draft amounts).
  const DebitSchedule: { DepositAmount: string; StartDate: string; NumberOfPayments: number }[] = [];
  for (const r of sched.rows) {
    const amt = r.weeklyDraftAmount;
    const last = DebitSchedule[DebitSchedule.length - 1];
    if (last && usd(amt) === last.DepositAmount) last.NumberOfPayments += 1;
    else DebitSchedule.push({ DepositAmount: usd(amt), StartDate: mdY(r.date), NumberOfPayments: 1 });
  }

  // Effective percentages: saved calc if present, else the calculator defaults.
  const settlementPct = latestCalc?.settlementPercentage ?? RESCHED.settlementPercent;
  const programFeePct = latestCalc?.programFeePercent ?? RESCHED.programFeePercent;
  const retainerPct = latestCalc?.retainerPercentage ?? RESCHED.retainerPercent;
  const serviceFeeVal = latestCalc?.serviceFee ?? 55;

  const dispensationFee = totalDebt * (programFeePct / 100);
  const totalWithFees = sched.rows.reduce((s, r) => s + r.weeklyDraftAmount, 0);

  return {
    ClientName: acct?.name ?? "",
    ClientAddress: acct?.billingStreet ?? "",
    ClientCity: acct?.billingCity ?? "",
    ClientState: acct?.billingState ?? "",
    ClientZip: acct?.billingZip ?? "",
    ClientPhone: acct?.phone ?? opp.primaryContact?.phone ?? "",
    ClientEmail: acct?.email ?? opp.primaryContact?.email ?? "",
    TotalDebt: usd(totalDebt),
    ProgramLength: String(term),
    FirstPaymentDate: mdY(firstPaymentDate),
    FirstPaymentAmount: usd(sched.rows[0]?.weeklyDraftAmount ?? 0),
    RetainerAmount: usd(t.retainerAmount),
    DispensationFee: usd(dispensationFee),
    SettlementPercent: String(settlementPct),
    ProgramFeePercent: String(programFeePct),
    RetainerPercent: String(retainerPct),
    SetupFee: usd(t.setupFee),
    ServiceFee: usd(serviceFeeVal),
    TotalWithFees: usd(totalWithFees),
    EstimatedSavings: usd(Math.round((totalDebt - totalWithFees) * 100) / 100),
    WeeklyPayment: usd(sched.rows[1]?.weeklyDraftAmount ?? t.weeklyDraftAmount),
    ProcessorName: acct?.paymentProcessor ?? "SAS",
    TodayDate: mdY(new Date()),
    Creditors,
    Schedule,
    DebitSchedule,
  };
}
