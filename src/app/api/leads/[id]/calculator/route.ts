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
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  const row = await prisma.leadPaymentCalculation.create({
    data: {
      leadId: id,
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
