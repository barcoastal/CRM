import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closerTransfers } from "@/lib/closer-tiers";

/** GET /api/dialer/closer-transfers?closerId=&from=&to= - one closer's transfers (drill-down). */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const sp = req.nextUrl.searchParams;
  const closerId = sp.get("closerId");
  if (!closerId) return NextResponse.json({ transfers: [] });
  const from = Date.parse(sp.get("from") ?? "") || Date.now() - 30 * 86400000;
  const to = Date.parse(sp.get("to") ?? "") || Date.now();
  const transfers = await closerTransfers(closerId, from, to);
  return NextResponse.json({ transfers });
}
