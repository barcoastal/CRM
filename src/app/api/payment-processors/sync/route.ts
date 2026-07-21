import { NextRequest, NextResponse } from "next/server";
import { runProcessorSync } from "@/lib/payment-processors";
import { getLastPollResult } from "@/lib/payment-processors/scheduler";
import { requireAuthOrRespond } from "@/lib/api-auth";

/**
 * Inbound processor sync (draft statuses + escrow balances).
 * Runs automatically every 30 minutes (scheduler.ts). This route triggers it
 * manually (POST) and reports the last automatic run (GET).
 *
 * Auth: x-cron-secret header (CRON_SECRET) or a session with Draft.Retry.
 */
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET ?? process.env.PROCESSOR_SYNC_SECRET;
  if (secret && (request.headers.get("x-cron-secret") === secret || request.headers.get("x-processor-sync-secret") === secret)) return true;
  const r = await requireAuthOrRespond("Draft.Retry");
  return !("response" in r);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const only = (url.searchParams.get("only") ?? "").toUpperCase();
  const since = url.searchParams.get("since") ?? undefined;
  const result = await runProcessorSync({
    since,
    only: only === "RAM" || only === "SAS" ? only : undefined,
  });
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ lastAutomaticRun: await getLastPollResult() });
}
