// src/app/api/email-center/domain-health/refresh/route.ts
/**
 * POST /api/email-center/domain-health/refresh
 * Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 *
 * Builds one snapshot. Call daily from the mini cron (03:00 branch).
 */
import { NextRequest, NextResponse } from "next/server";
import { buildDomainHealthSnapshot } from "@/lib/email/domain-health";

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
  const snap = await buildDomainHealthSnapshot();
  return NextResponse.json({ ok: true, ...snap });
}
