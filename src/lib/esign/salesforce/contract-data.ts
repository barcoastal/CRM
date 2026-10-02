import { z } from "zod";
import type { MergeData } from "@/lib/contracts/docx-merge";
const money = z.number().finite().nonnegative().max(10000000);
const date = z.iso.date();
const text = z.string().trim().min(1).max(255);
export const contractSchema = z
  .object({
    version: z.literal(2),
    legalNetwork: z.enum(["Citadel", "Victory Legal Plan"]),
    county: text,
    phone: text,
    firstName: text,
    lastName: text,
    title: z.string().trim().min(1).max(150),
    birthdate: date,
    ein: z.string().regex(/^\d{9}$/),
    taxId: z.string().regex(/^\d{9}$/),
    bank: z.object({
      name: text,
      routing: z.string().regex(/^\d{9}$/),
      account: z.string().regex(/^\d{4,20}$/),
      type: z.enum(["Checking", "Savings"]),
    }),
    plan: z.object({
      id: z.string().min(15).max(18),
      termMonths: z.number().int().positive().max(60),
      frequency: z.literal("Weekly"),
      firstPaymentDate: date,
      settlementPercent: z.number().min(0).max(100),
      programFeePercent: z.number().min(0).max(100),
      retainerPercent: z.number().min(0).max(100),
      weeklyServiceFee: money,
      totalDebt: money.positive(),
      totalDraft: money,
      totalRetainer: money,
      totalProgram: money,
      totalSetup: money,
      totalService: money,
      totalBank: money,
      totalLegal: money,
      totalEscrow: money,
    }),
    debts: z
      .array(
        z.object({
          creditor: text,
          balance: money.positive(),
          accountNumber: text,
        }),
      )
      .min(1)
      .max(200),
    drafts: z
      .array(
        z.object({
          date,
          amount: money,
          retainer: money,
          program: money,
          setup: money,
          service: money,
          bank: money,
          legal: money,
          escrow: money,
        }),
      )
      .min(1)
      .max(1000),
    debitSchedule: z
      .array(
        z.object({
          date,
          amount: money,
          count: z.number().int().positive().max(1000),
        }),
      )
      .min(1)
      .max(1000),
  })
  .superRefine((c, ctx) => {
    const cents = (v: number) => Math.round(v * 100);
    const same = (a: number, b: number, label: string) => {
      if (cents(a) !== cents(b))
        ctx.addIssue({
          code: "custom",
          message: `${label} does not match the saved Salesforce plan.`,
        });
    };
    same(
      c.debts.reduce((s, d) => s + d.balance, 0),
      c.plan.totalDebt,
      "Enrolled debt",
    );
    const parts = [
      "retainer",
      "program",
      "setup",
      "service",
      "bank",
      "legal",
      "escrow",
    ] as const;
    const totals = [
      "totalRetainer",
      "totalProgram",
      "totalSetup",
      "totalService",
      "totalBank",
      "totalLegal",
      "totalEscrow",
    ] as const;
    c.drafts.forEach((d, i) => {
      same(
        parts.reduce((s, k) => s + d[k], 0),
        d.amount,
        `Draft ${i + 1}`,
      );
      if (i && d.date < c.drafts[i - 1].date)
        ctx.addIssue({
          code: "custom",
          message: "Salesforce drafts must be ordered by date.",
        });
    });
    parts.forEach((k, i) =>
      same(
        c.drafts.reduce((s, d) => s + d[k], 0),
        c.plan[totals[i]],
        k,
      ),
    );
    same(
      c.drafts.reduce((s, d) => s + d.amount, 0),
      c.plan.totalDraft,
      "Scheduled total",
    );
    same(
      c.debitSchedule.reduce((s, d) => s + d.amount * d.count, 0),
      c.plan.totalDraft,
      "Debit schedule total",
    );
    if (c.debitSchedule.reduce((s, d) => s + d.count, 0) !== c.drafts.length)
      ctx.addIssue({
        code: "custom",
        message: "Debit schedule payment count does not match drafts.",
      });
    let index = 0;
    for (const g of c.debitSchedule) {
      if (c.drafts[index]?.date !== g.date)
        ctx.addIssue({
          code: "custom",
          message: "Debit schedule start date does not match drafts.",
        });
      for (let n = 0; n < g.count; n++, index++)
        if (c.drafts[index])
          same(c.drafts[index].amount, g.amount, "Debit schedule payment");
    }
    if (c.plan.firstPaymentDate !== c.drafts[0]?.date)
      ctx.addIssue({
        code: "custom",
        message: "First payment date does not match drafts.",
      });
  });
export type SalesforceContract = z.infer<typeof contractSchema>;
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const mdy = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};
/** Use saved rows verbatim: never recalculate or supply sample financial terms. */
export function salesforceMergeData(
  s: {
    accountName: string;
    signerName: string;
    signerEmail: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    processor: "SAS" | "RAM";
    totalDebt: number;
    contract: SalesforceContract;
  },
  now = new Date(),
): MergeData {
  const c = contractSchema.parse(s.contract),
    p = c.plan,
    first = c.drafts[0];
  if (Math.round(s.totalDebt * 100) !== Math.round(p.totalDebt * 100))
    throw new Error(
      "Salesforce current debt differs from the enrolled plan. Recalculate the plan.",
    );
  return {
    ClientName: s.accountName,
    ClientAddress: s.street,
    ClientCity: s.city,
    ClientState: s.state,
    ClientZip: s.postalCode,
    ClientCountry: s.country,
    ClientCounty: c.county,
    ClientPhone: c.phone,
    ClientEmail: s.signerEmail,
    ClientSignerName: s.signerName,
    ContactFirstName: c.firstName,
    ContactLastName: c.lastName,
    ContactTitle: c.title,
    ContactDOB: mdy(c.birthdate),
    ContactHomePhone: c.phone,
    ContactCellPhone: c.phone,
    ClientSSN: c.taxId,
    ClientEIN: c.ein,
    BankName: c.bank.name,
    BankRoutingNumber: c.bank.routing,
    BankAccountNumber: c.bank.account,
    BankAccountType: c.bank.type,
    BankIsChecking: c.bank.type === "Checking" ? "X" : "",
    BankIsSavings: c.bank.type === "Savings" ? "X" : "",
    ProgramState: s.state,
    TotalDebt: usd(p.totalDebt),
    ProgramLength: String(p.termMonths),
    FirstPaymentDate: mdy(p.firstPaymentDate),
    FirstPaymentAmount: usd(first.amount),
    FirstRetainerSetupFee: usd(first.retainer + first.setup),
    RetainerAmount: usd(p.totalRetainer),
    ProgramFeeAmount: usd(p.totalProgram),
    DispensationFee: usd(p.totalProgram),
    SettlementPercent: String(p.settlementPercent),
    ProgramFeePercent: String(p.programFeePercent),
    RetainerPercent: String(p.retainerPercent),
    TotalFeePercent: String(p.programFeePercent + p.retainerPercent),
    SetupFee: usd(p.totalSetup),
    ServiceFee: usd(p.weeklyServiceFee),
    TotalWithFees: usd(p.totalDraft),
    EstimatedSavings: usd(p.totalDebt - p.totalDraft),
    WeeklyPayment: usd((c.drafts[1] || first).amount),
    ProcessorName: s.processor,
    TotalRetainerFee: usd(p.totalRetainer),
    TotalProgramFee: usd(p.totalProgram),
    TotalSetupFee: usd(p.totalSetup),
    TotalServiceFee: usd(p.totalService),
    TotalBankFee: usd(p.totalBank),
    TotalLegalPlanFee: usd(p.totalLegal),
    TotalEscrowAmount: usd(p.totalEscrow),
    CurrentDay: String(now.getUTCDate()),
    CurrentMonth: now.toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    }),
    CurrentYear: String(now.getUTCFullYear()),
    TodayDate: mdy(now.toISOString().slice(0, 10)),
    Creditors: c.debts.map((d) => ({
      CreditorName: d.creditor,
      Balance: usd(d.balance),
      AccountNumber: d.accountNumber,
    })),
    Schedule: c.drafts.map((d) => ({
      Date: mdy(d.date),
      Amount: usd(d.amount),
      RetainerFee: usd(d.retainer),
      ProgramFee: usd(d.program),
      SetupFee: usd(d.setup),
      ServiceFee: usd(d.service),
      BankFee: usd(d.bank),
      LegalPlanFee: usd(d.legal),
      SettlementAccount: usd(d.escrow),
    })),
    DebitSchedule: c.debitSchedule.map((d) => ({
      DepositAmount: usd(d.amount),
      StartDate: mdy(d.date),
      NumberOfPayments: d.count,
    })),
  };
}

export function salesforcePacketPlan(s: {
  processor: "SAS" | "RAM";
  includeAddendum: boolean;
  contract: SalesforceContract;
}): import("@/lib/contracts/routing").PacketPlan {
  const legal =
    s.contract.legalNetwork === "Victory Legal Plan" ? "Victory" : "Citadel";
  return {
    processor: s.processor,
    legal,
    categories: [
      "COASTAL",
      ...(s.includeAddendum ? ["ADDENDUM" as const] : []),
      s.processor === "RAM" ? "PROCESSOR_RAM" : "PROCESSOR_SAS",
      legal === "Victory" ? "LEGAL_VICTORY" : "LEGAL_CITADEL",
    ],
  };
}
