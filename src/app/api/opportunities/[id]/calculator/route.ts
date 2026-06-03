import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Accept both V1 names (settlementPercentage, monthlyBankFee, programFeePercent, retainerPercentage)
  // and V2 names (settlementPercent, bankFeePerPeriod, programFeePercent, retainerPercent).
  const row = await prisma.opportunityPaymentCalculation.create({
    data: {
      opportunityId: id,
      totalDebt: n(body.totalDebt),
      setupFee: n(body.setupFee),
      serviceFee: n(body.serviceFee ?? body.serviceFeePerPeriod),
      monthlyBankFee: n(body.monthlyBankFee ?? body.bankFeePerPeriod),
      citadelFee: n(body.citadelFee ?? body.citadelFeePerPeriod),
      settlementPercentage: n(body.settlementPercentage ?? body.settlementPercent),
      programFeePercent: n(body.programFeePercent),
      totalSettlement: n(body.totalSettlement),
      programFeePeriod:
        typeof (body.programFeePeriod ?? body.paymentTerm) === "number"
          ? Math.round(body.programFeePeriod ?? body.paymentTerm)
          : null,
      frequency: typeof body.frequency === "string" ? body.frequency : null,
      firstPaymentDate: body.firstPaymentDate ? new Date(body.firstPaymentDate) : null,
      estimatedAmount: n(body.estimatedAmount),
      retainerPercentage: n(body.retainerPercentage ?? body.retainerPercent),
      savedById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, savedAt: row.savedAt.toISOString() });
}
