/**
 * Starts campaigns whose scheduledAt has passed. Call every minute from the
 * external cron alongside /api/flow/poll.
 *
 *   POST /api/emails/mass/process-scheduled
 *   Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startMassEmailJob } from "@/lib/email/mass-sender";

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
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await prisma.massEmail.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
    take: 10,
    orderBy: { scheduledAt: "asc" },
  });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const m of due) {
    const r = await startMassEmailJob(m.id);
    results.push({ id: m.id, ok: r.ok, error: r.error });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
