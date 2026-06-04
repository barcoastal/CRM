import { NextRequest, NextResponse } from "next/server";
import { runProcessorSync } from "@/lib/payment-processors";

/**
 * Cron-driven payment processor sync. Hit every 15-60 minutes.
 *
 * Auth: set PROCESSOR_SYNC_SECRET in env; call with header
 *   x-processor-sync-secret: <secret>
 *   or query ?secret=<secret>
 *
 * Optional query:
 *   only=RAM | only=SAS
 *   since=YYYY-MM-DD       (default: yesterday)
 */
export async function POST(request: NextRequest) {
  const required = process.env.PROCESSOR_SYNC_SECRET;
  if (required) {
    const got =
      request.headers.get("x-processor-sync-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const only = (url.searchParams.get("only") ?? "").toUpperCase();
  const since = url.searchParams.get("since") ?? undefined;

  const result = await runProcessorSync({
    since,
    only: only === "RAM" || only === "SAS" ? only : undefined,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
