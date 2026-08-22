import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closerDashboard } from "@/lib/closer-tiers";

/** GET /api/dialer/closer-dashboard - per-closer transfer counts + debt (today/month). */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await closerDashboard(Date.now());
  return NextResponse.json({ rows });
}
