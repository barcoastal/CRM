import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { buildForecastRollup, summarizeRollup } from "@/lib/forecasting/rollup";
import { currentMonthPeriod } from "@/lib/forecasting/period";

export async function GET(req: Request) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || currentMonthPeriod();
  const forUserIdRaw = url.searchParams.get("forUserId");
  const teamParam = url.searchParams.get("team");
  const includeTeam = teamParam === "1" || teamParam === "true";

  // null means "all users" (org-wide); otherwise default to current user.
  const forUserId = forUserIdRaw === "ALL" ? null : forUserIdRaw || r.session.userId;

  try {
    const rows = await buildForecastRollup({ period, forUserId, includeTeam });
    const summary = summarizeRollup(rows);
    return NextResponse.json({ period, rows, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "rollup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
