import { NextRequest, NextResponse } from "next/server";
import { runCadenceTick } from "@/lib/cadences";

/**
 * Cron-driven cadence runner. Hit this every 5-10 minutes from Railway
 * cron / GitHub Actions / external cron.
 *
 * Auth: set CADENCE_RUN_SECRET in env and call with header
 *   x-cadence-secret: <secret>
 * (or pass ?secret=...)
 */
export async function POST(request: NextRequest) {
  const required = process.env.CADENCE_RUN_SECRET;
  if (required) {
    const got =
      request.headers.get("x-cadence-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCadenceTick();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  // Allow GET too for simple cron services
  return POST(request);
}
