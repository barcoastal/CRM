import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { rollupPayments } from "@/lib/payment-rollup";

/**
 * Live rollup of the Account's payment state. Recomputes from Draft + Fee +
 * Settlement on every request. Writes the result to the PaymentSummary cache.
 *
 * For a cheap read-only call later, query PaymentSummary directly.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const plans = await prisma.programPlan.findMany({
    where: { accountId: id },
    select: { id: true },
  });
  const planIds = plans.map((p) => p.id);

  const [drafts, fees, debts] = await Promise.all([
    prisma.draft.findMany({
      where: { programPlanId: { in: planIds } },
      select: { status: true, amount: true, settledAt: true },
    }),
    prisma.fee.findMany({
      where: { programPlanId: { in: planIds } },
      select: { status: true, amount: true },
    }),
    prisma.debt.findMany({
      where: { programPlanId: { in: planIds } },
      select: { id: true },
    }),
  ]);
  const debtIds = debts.map((d) => d.id);
  const settlements = await prisma.settlement.findMany({
    where: { debtId: { in: debtIds } },
    select: { status: true, settledAmount: true, savingsAmount: true, payoffPaidDate: true },
  });

  const rollup = rollupPayments({ drafts, fees, settlements });

  // Cache the result
  await prisma.paymentSummary.upsert({
    where: { accountId: id },
    create: {
      accountId: id,
      ...rollup,
      lastDraftDate: rollup.lastDraftDate ?? null,
    },
    update: {
      ...rollup,
      lastDraftDate: rollup.lastDraftDate ?? null,
      recomputedAt: new Date(),
    },
  });

  return NextResponse.json(rollup);
}
