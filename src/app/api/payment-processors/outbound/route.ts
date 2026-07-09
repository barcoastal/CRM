import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { drainSasQueue, sasOutboundMode } from "@/lib/payment-processors/sas-outbound";

/**
 * Outbound processor push - drains drafts with processorSyncStatus=PENDING.
 *
 * POST: run the drain (optionally ?programPlanId=... to scope to one plan).
 *   In test mode (SAS_OUTBOUND_MODE unset or "test") nothing is sent - the
 *   exact payloads are journaled to ProcessorSyncLog as DRY_RUN.
 * GET: queue depth + the latest journal entries, for auditing before go-live.
 *
 * Auth: session with Draft.Retry, or x-cron-secret header.
 */
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") === secret) return true;
  const r = await requireAuthOrRespond("Draft.Retry");
  return !("response" in r);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const programPlanId = new URL(request.url).searchParams.get("programPlanId") ?? undefined;
  try {
    const result = await drainSasQueue({ programPlanId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Drain failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [pending, logs] = await Promise.all([
    prisma.draft.count({ where: { processorSyncStatus: "PENDING" } }),
    prisma.processorSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({ mode: sasOutboundMode(), pendingDrafts: pending, recentLogs: logs });
}
