/**
 * Cron-driven engagement processor. Hit every ~10 minutes.
 *
 * Auth: reuses PROCESSOR_SYNC_SECRET (same as payment processors sync). Pass
 *   via x-processor-sync-secret header or ?secret= query.
 *
 *   POST /api/engagement/process
 *   GET  /api/engagement/process   (alias for cron-job.org GET-only setups)
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateAndEnroll, processEnrollments } from "@/lib/engagement/engine";

async function handle(request: NextRequest) {
  const required = process.env.PROCESSOR_SYNC_SECRET;
  if (required) {
    const got =
      request.headers.get("x-processor-sync-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");

  const enroll = await evaluateAndEnroll();
  const processed = await processEnrollments({ limit });

  return NextResponse.json({ ok: true, enroll, process: processed });
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}
