import { canAccessRecord } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { calculatorStateSchema } from "@/lib/payments/calculator-state";

function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  if (!(await canAccessRecord("opportunity", id)))
    return Response.json({ error: "Not found" }, { status: 404 });

  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp)
    return ssnSafeJson({ error: "Opportunity not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const state =
    body.scheduleState === undefined
      ? null
      : calculatorStateSchema.safeParse(body.scheduleState);
  if (state && !state.success)
    return ssnSafeJson(
      { error: "The calculation has an invalid date, amount, or split." },
      { status: 400 },
    );
  if (
    state &&
    !Object.prototype.hasOwnProperty.call(body, "expectedCalculationId")
  )
    return ssnSafeJson(
      { error: "Reload the calculation before saving." },
      { status: 409 },
    );

  // Accept both V1 names (settlementPercentage, monthlyBankFee, programFeePercent, retainerPercentage)
  // and V2 names (settlementPercent, bankFeePerPeriod, programFeePercent, retainerPercent).
  try {
    const row = await prisma.$transaction(
      async (tx) => {
        const latest = await tx.opportunityPaymentCalculation.findFirst({
          where: { opportunityId: id },
          orderBy: { savedAt: "desc" },
        });
        if (state && (latest?.id ?? null) !== body.expectedCalculationId)
          throw new Error(
            "The calculation changed. Reload before saving your changes.",
          );
        const row = await tx.opportunityPaymentCalculation.create({
          data: {
            opportunityId: id,
            totalDebt: n(body.totalDebt),
            setupFee: n(body.setupFee),
            serviceFee: n(body.serviceFee ?? body.serviceFeePerPeriod),
            monthlyBankFee: n(body.monthlyBankFee ?? body.bankFeePerPeriod),
            citadelFee: n(body.citadelFee ?? body.citadelFeePerPeriod),
            settlementPercentage: n(
              body.settlementPercentage ?? body.settlementPercent,
            ),
            programFeePercent: n(body.programFeePercent),
            totalSettlement: n(body.totalSettlement),
            programFeePeriod:
              typeof (body.programFeePeriod ?? body.paymentTerm) === "number"
                ? Math.round(body.programFeePeriod ?? body.paymentTerm)
                : null,
            frequency:
              typeof body.frequency === "string" ? body.frequency : null,
            firstPaymentDate: body.firstPaymentDate
              ? new Date(body.firstPaymentDate)
              : null,
            estimatedAmount: n(body.estimatedAmount),
            retainerPercentage: n(
              body.retainerPercentage ?? body.retainerPercent,
            ),
            savedById: session.userId,
            ...(state?.success ? { scheduleJson: state.data } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: session.userId,
            entity: "OpportunityPaymentCalculation",
            entityId: row.id,
            action: "CREATE",
            after: {
              opportunityId: id,
              calculationId: row.id,
              previousCalculationId: latest?.id ?? null,
            },
          },
        });
        return row;
      },
      { isolationLevel: "Serializable" },
    );

    return ssnSafeJson({
      ok: true,
      id: row.id,
      savedAt: row.savedAt.toISOString(),
    });
  } catch (e) {
    return ssnSafeJson(
      {
        error:
          (e as { code?: string }).code === "P2034"
            ? "The calculation changed. Reload before saving."
            : e instanceof Error
              ? e.message
              : "Could not save calculation",
      },
      { status: 409 },
    );
  }
}
