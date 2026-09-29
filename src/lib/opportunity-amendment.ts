import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  debtPaymentStatus,
  debtSnapshot,
  PAYMENT_STATUSES,
} from "@/lib/debt-payment-status";

const money = z
  .number()
  .finite()
  .nonnegative()
  .max(100_000_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
export const amendmentSchema = z
  .object({
    revision: z.string().length(64),
    reason: z.string().trim().min(3).max(2000),
    termMonths: z.number().int().min(1).max(30),
    firstPaymentDate: z.iso.date(),
    debts: z
      .array(
        z
          .object({
            id: z.string().optional(),
            creditorName: z.string().trim().min(1).max(200),
            originalBalance: money.refine((n) => n > 0),
            currentBalance: money,
            enrolledBalance: money,
            paymentAmount: money.nullable(),
            paymentFrequency: z.string().max(40),
            paymentStatus: z.string().max(80),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    payments: z
      .array(
        z
          .object({
            id: z.string(),
            amount: money.refine((n) => n > 0),
            date: z.iso.date(),
          })
          .strict(),
      )
      .max(1500),
  })
  .strict();
export type AmendmentInput = z.infer<typeof amendmentSchema>;
export const amendmentInclude = {
  client: { select: { id: true } },
  debts: { orderBy: { id: "asc" as const } },
  programPlans: {
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { id: "asc" as const },
    include: {
      drafts: {
        orderBy: [{ scheduledDate: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  paymentCalculations: { orderBy: { savedAt: "desc" as const }, take: 1 },
} satisfies Prisma.OpportunityInclude;
type AmendmentRecord = Prisma.OpportunityGetPayload<{
  include: typeof amendmentInclude;
}>;
const pending = (status: string) => ["SCHEDULED", "RETRYING"].includes(status);
const money2 = (n: number) => Math.round(n * 100) / 100;
export function amendmentView(opp: AmendmentRecord) {
  const latest = opp.paymentCalculations[0];
  const debts = opp.debts.map((d) => ({
    id: d.id,
    creditorName: d.creditorName,
    originalBalance: d.originalBalance,
    currentBalance: d.currentBalance,
    enrolledBalance: d.enrolledBalance,
    paymentAmount: d.paymentAmount,
    paymentFrequency: d.paymentFrequency || "",
    paymentStatus: debtPaymentStatus(d.sfDataJson),
    locked: ["SETTLED", "PAID", "WRITTEN_OFF"].includes(d.status),
  }));
  const payments = opp.programPlans.flatMap((p) =>
    p.drafts
      .filter((d) => pending(d.status))
      .map((d) => ({
        id: d.id,
        planId: p.id,
        amount: d.amount,
        date: d.scheduledDate.toISOString().slice(0, 10),
        fees: money2(
          d.feeBank +
            d.feeLegal +
            d.feeProgram +
            d.feeRetainer +
            d.feeService +
            d.feeSetup,
        ),
      })),
  );
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        version: opp.version,
        updatedAt: opp.updatedAt,
        debts: opp.debts,
        plans: opp.programPlans,
        calc: latest?.id,
      }),
    )
    .digest("hex");
  return {
    revision,
    version: opp.version,
    debts,
    payments,
    termMonths:
      latest?.programFeePeriod ?? opp.programPlans[0]?.termMonths ?? 6,
    firstPaymentDate: (
      latest?.firstPaymentDate ??
      opp.firstDraftDate ??
      new Date()
    )
      .toISOString()
      .slice(0, 10),
  };
}

export type AmendmentView = ReturnType<typeof amendmentView>;
export async function applyOpportunityAmendment(
  tx: Prisma.TransactionClient,
  id: string,
  data: AmendmentInput,
  userId: string,
  canEditPayments: boolean,
) {
  const opp = await tx.opportunity.findUnique({
    where: { id },
    include: amendmentInclude,
  });
  if (!opp) throw new Error("Opportunity not found");
  const before = amendmentView(opp);
  if (data.revision !== before.revision)
    throw new Error(
      "This opportunity changed while you were editing. Close and reopen the amendment to review the latest values.",
    );
  const ids = data.debts.flatMap((d) => (d.id ? [d.id] : []));
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== opp.debts.length ||
    opp.debts.some((d) => !ids.includes(d.id))
  )
    throw new Error("Existing debts must be preserved in the amendment");
  if (
    new Set(data.payments.map((d) => d.id)).size !== data.payments.length ||
    data.payments.length !== before.payments.length ||
    before.payments.some((d) => !data.payments.some((p) => p.id === d.id))
  )
    throw new Error("The payment schedule changed. Reload the amendment.");
  const changedDebts = data.debts.filter((d) => {
    const old = before.debts.find((b) => b.id === d.id);
    if (!old) return true;
    return Object.entries(d).some(([k, v]) => old[k as keyof typeof old] !== v);
  });
  const changedPayments = data.payments.filter((d) => {
    const old = before.payments.find((p) => p.id === d.id)!;
    return d.amount !== old.amount || d.date !== old.date;
  });
  const paramsChanged =
    data.termMonths !== before.termMonths ||
    data.firstPaymentDate !== before.firstPaymentDate;
  if (!changedDebts.length && !changedPayments.length && !paramsChanged)
    throw new Error("Make a debt or payment change before saving an amendment");
  if (
    (changedPayments.length || (paramsChanged && opp.programPlans.length)) &&
    !canEditPayments
  )
    throw new Error("Payment editing permission required");
  if (
    opp.programPlans.length &&
    data.firstPaymentDate !== before.firstPaymentDate
  )
    throw new Error(
      "Use the scheduled payment dates below to change an active plan; its original first payment date is preserved",
    );
  for (const d of changedDebts) {
    const old = opp.debts.find((b) => b.id === d.id);
    if (old && before.debts.find((b) => b.id === d.id)?.locked)
      throw new Error(
        "Settled, paid, and written-off debts cannot be changed in an amendment",
      );
    if (!old && !d.paymentStatus)
      throw new Error("Choose a payment status for each new debt");
    if (
      d.paymentStatus !== debtPaymentStatus(old?.sfDataJson ?? null) &&
      !PAYMENT_STATUSES.includes(
        d.paymentStatus as (typeof PAYMENT_STATUSES)[number],
      )
    )
      throw new Error(
        "Choose Current, Default, or Reprieve for the debt status",
      );
    if (
      d.paymentFrequency !== (old?.paymentFrequency ?? "") &&
      !["DAILY", "WEEKLY", "MONTHLY"].includes(d.paymentFrequency)
    )
      throw new Error("Choose Daily, Weekly, or Monthly for the frequency");
    const { id: debtId, paymentStatus, ...values } = d;
    const sf = {
      ...debtSnapshot(old?.sfDataJson ?? null),
      Debt_Status__c: paymentStatus,
    };
    if (old)
      await tx.debt.update({
        where: { id: debtId },
        data: {
          ...values,
          paymentFrequency: d.paymentFrequency || null,
          sfDataJson: JSON.stringify(sf),
        },
      });
    else
      await tx.debt.create({
        data: {
          ...values,
          opportunityId: id,
          clientId: opp.client?.id,
          programPlanId:
            opp.programPlans.length === 1 ? opp.programPlans[0].id : null,
          paymentFrequency: d.paymentFrequency || null,
          sfDataJson: JSON.stringify(sf),
        },
      });
  }
  const changedPlanIds = new Set<string>();
  for (const p of changedPayments) {
    const old = before.payments.find((d) => d.id === p.id)!;
    if (p.amount < old.fees)
      throw new Error("A payment cannot be less than its allocated fees");
    if (p.amount > 10_000 && p.amount !== old.amount)
      throw new Error(
        "Payments above $10,000 must be split using the payment table",
      );
    const date = new Date(`${p.date}T00:00:00.000Z`);
    if ([0, 6].includes(date.getUTCDay()))
      throw new Error("Scheduled payment dates must be business days");
    await tx.draft.update({
      where: { id: p.id },
      data: {
        amount: p.amount,
        scheduledDate: date,
        escrowAmount: money2(p.amount - old.fees),
        processorSyncStatus: "PENDING",
      },
    });
    changedPlanIds.add(old.planId);
  }
  const totalDebt = money2(
    data.debts.reduce((sum, d) => sum + d.originalBalance, 0),
  );
  const currentTotalDebt = money2(
    data.debts.reduce((sum, d) => sum + d.currentBalance, 0),
  );
  const perWeek: Record<string, number> = {
    DAILY: 5,
    WEEKLY: 1,
    MONTHLY: 0.25,
    BI_WEEKLY: 0.5,
    LUMP_SUM: 0,
    "": 0,
  };
  const currentWeeklyPayment = money2(
    data.debts.reduce(
      (sum, d) =>
        sum + (d.paymentAmount ?? 0) * (perWeek[d.paymentFrequency] ?? 0),
      0,
    ),
  );
  const versionParts = opp.version.split(".");
  const version = `${Number(versionParts[0]) || 1}.${(Number(versionParts[1]) || 0) + 1}`;
  await tx.opportunity.update({
    where: { id },
    data: {
      version,
      totalDebt,
      currentTotalDebt,
      currentWeeklyPayment,
      currentMonthlyPayment: money2(currentWeeklyPayment * 4),
      firstDraftDate: opp.programPlans.length
        ? opp.firstDraftDate
        : new Date(`${data.firstPaymentDate}T00:00:00.000Z`),
    },
  });
  for (const plan of opp.programPlans) {
    const drafts = await tx.draft.findMany({
      where: {
        programPlanId: plan.id,
        status: { notIn: ["CANCELLED", "SKIPPED", "FAILED"] },
      },
    });
    await tx.programPlan.update({
      where: { id: plan.id },
      data: {
        ...(data.termMonths !== before.termMonths
          ? { termMonths: data.termMonths }
          : {}),
        ...(opp.programPlans.length === 1
          ? {
              totalEnrolledDebt: money2(
                data.debts.reduce((s, d) => s + d.enrolledBalance, 0),
              ),
            }
          : {}),
        ...(changedPlanIds.has(plan.id)
          ? {
              totalProgramCost: money2(
                drafts.reduce((s, d) => s + d.amount, 0),
              ),
            }
          : {}),
      },
    });
  }
  const latest = opp.paymentCalculations[0];
  const {
    id: _calcId,
    opportunityId: _oppId,
    createdAt: _created,
    updatedAt: _updated,
    savedAt: _saved,
    scheduleJson: _schedule,
    ...calculation
  } = latest ?? {};
  await tx.opportunityPaymentCalculation.create({
    data: {
      ...calculation,
      opportunityId: id,
      totalDebt,
      programFeePeriod: data.termMonths,
      firstPaymentDate: new Date(`${data.firstPaymentDate}T00:00:00.000Z`),
      savedById: userId,
      scheduleJson: Prisma.DbNull,
    },
  });
  const after = {
    version,
    reason: data.reason,
    debts: data.debts,
    payments: data.payments,
    termMonths: data.termMonths,
    firstPaymentDate: data.firstPaymentDate,
  };
  await tx.opportunityHistory.create({
    data: {
      opportunityId: id,
      field: "Amendment",
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(after),
      changedById: userId,
    },
  });
  await tx.auditLog.create({
    data: {
      userId,
      entity: "Opportunity",
      entityId: id,
      action: "UPDATE",
      before: JSON.parse(JSON.stringify(before)),
      after,
    },
  });
  return { version, changedPlanIds: [...changedPlanIds] };
}
