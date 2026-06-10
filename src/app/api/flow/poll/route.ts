/**
 * Flow run resume poller. Finds all FlowRun rows where status=WAITING and
 * scheduledResumeAt has passed, then resumes each one. Should be called every
 * 60 seconds by an external cron (Railway scheduler, Vercel Cron, GitHub
 * Actions, etc.).
 *
 *   POST /api/flow/poll
 *   Headers: Authorization: Bearer ${FLOW_POLL_SECRET}
 *     (falls back to PROCESSOR_SYNC_SECRET so existing infrastructure works)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resumeRun } from "@/lib/flow/executor";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const primary = process.env.FLOW_POLL_SECRET;
  const fallback = process.env.PROCESSOR_SYNC_SECRET;
  if (!primary && !fallback) return false;
  if (primary && token === primary) return true;
  if (fallback && token === fallback) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const waiting = await prisma.flowRun.findMany({
    where: {
      status: "WAITING",
      scheduledResumeAt: { lte: now },
    },
    take: 50,
    orderBy: { scheduledResumeAt: "asc" },
  });

  let resumed = 0;
  let failed = 0;
  for (const run of waiting) {
    try {
      await resumeRun(run.id);
      resumed += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({ resumed, failed, scanned: waiting.length });
}

export async function GET(req: NextRequest) {
  // Allow GET for cron systems that prefer GET.
  return POST(req);
}
