import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closerStats } from "@/lib/closer-tiers";

/** GET /api/dialer/closer-stats - per-closer production for the floor manager. */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await closerStats();
  return NextResponse.json({ rows });
}
