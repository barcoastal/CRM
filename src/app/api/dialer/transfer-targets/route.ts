import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { transferTargetsForDebt } from "@/lib/closer-tiers";

/**
 * GET /api/dialer/transfer-targets?debt=300000  (or ?leadId=...)
 * Returns the tiered closers with live Five9 availability for a transfer,
 * preferred tier first then fallback tiers. Used by the dialer transfer panel.
 * When leadId is given, the deal's debt is resolved server-side from the lead.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;

  let debt = Math.max(0, Number(req.nextUrl.searchParams.get("debt")) || 0);

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (leadId && debt === 0) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { totalDebtEst: true, sfDataJson: true, debts: { select: { amount: true } } },
    });
    if (lead) {
      const fromRows = lead.debts.reduce((s, d) => s + (d.amount ?? 0), 0);
      let fromSf = 0;
      try {
        const sf = lead.sfDataJson ? (JSON.parse(lead.sfDataJson) as Record<string, unknown>) : {};
        fromSf = Number(sf.Estimated_Total_Debt__c ?? sf.Total_Debt_Amount__c ?? 0) || 0;
      } catch { /* ignore */ }
      debt = fromRows || lead.totalDebtEst || fromSf || 0;
    }
  }

  const result = await transferTargetsForDebt(debt);
  return NextResponse.json(result);
}
