import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closerScoreboard } from "@/lib/closer-tiers";

/** GET /api/scoreboard - closer leaderboard with live availability. */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await closerScoreboard();
  return NextResponse.json({ rows });
}
