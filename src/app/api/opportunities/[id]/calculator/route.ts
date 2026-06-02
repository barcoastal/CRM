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

  const row = await prisma.opportunityPaymentCalculation.create({
    data: {
      opportunityId: id,
      totalDebt: n(body.totalDebt),
      setupFee: n(body.setupFee),
      serviceFee: n(body.serviceFee),
      monthlyBankFee: n(body.monthlyBankFee),
      settlementPercentage: n(body.settlementPercentage),
      programFeePercent: n(body.programFeePercent),
      totalSettlement: n(body.totalSettlement),
      programFeePeriod: typeof body.programFeePeriod === "number" ? Math.round(body.programFeePeriod) : null,
      estimatedAmount: n(body.estimatedAmount),
      retainerPercentage: n(body.retainerPercentage),
      savedById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, savedAt: row.savedAt.toISOString() });
}
