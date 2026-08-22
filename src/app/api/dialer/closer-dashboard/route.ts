import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closerDashboard, easternBoundaries } from "@/lib/closer-tiers";

/**
 * GET /api/dialer/closer-dashboard?from=<iso>&to=<iso>
 * Per-closer transfers + closed + debt for the given range. Defaults to this
 * month (US Eastern) when no range is passed.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  let fromMs = fromParam ? Date.parse(fromParam) : NaN;
  let toMs = toParam ? Date.parse(toParam) : NaN;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    const { startOfMonth } = easternBoundaries(Date.now());
    fromMs = startOfMonth.getTime();
    toMs = Date.now();
  }

  const rows = await closerDashboard(fromMs, toMs);
  return NextResponse.json({ rows, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() });
}
