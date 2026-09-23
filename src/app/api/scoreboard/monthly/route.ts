import { requireAuthOrRespond } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { monthlyScoreboard } from "@/lib/scoreboard";
import { currentScoreboardPeriod, validScoreboardPeriod } from "@/lib/scoreboard-shared";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireAuthOrRespond();
  if ("response" in auth) return auth.response;
  const now = new Date();
  const period = new URL(request.url).searchParams.get("period") || currentScoreboardPeriod(now);
  if (!validScoreboardPeriod(period)) return Response.json({ error: "Choose a valid month." }, { status: 400 });
  try {
    const rows = await monthlyScoreboard(period, now);
    return Response.json({ period, rows, generatedAt: now.toISOString(), canManage: hasPermission(auth.session.permissions, "Setup.Admin") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scoreboard] Monthly data failed", error);
    return Response.json({ error: "The scoreboard could not refresh. Retrying shortly." }, { status: 503 });
  }
}
