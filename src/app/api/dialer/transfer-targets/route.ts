import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { transferTargetsForDebt } from "@/lib/closer-tiers";

/**
 * GET /api/dialer/transfer-targets?debt=300000
 * Returns the tiered closers with live Five9 availability for a transfer,
 * preferred tier first then fallback tiers. Used by the dialer transfer panel.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;

  const debtParam = req.nextUrl.searchParams.get("debt");
  const debt = Math.max(0, Number(debtParam) || 0);

  const result = await transferTargetsForDebt(debt);
  return NextResponse.json(result);
}
