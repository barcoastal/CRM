import { NextRequest, NextResponse } from "next/server";
import { drainSmsQueue } from "@/lib/sms-sender";

/**
 * Cron-driven SMS sender. Hit every 1-5 minutes.
 *   POST /api/sms/send-queue
 *   Header: x-sms-secret: <SMS_SEND_SECRET>   (optional but recommended)
 */
export async function POST(request: NextRequest) {
  const required = process.env.SMS_SEND_SECRET;
  if (required) {
    const got =
      request.headers.get("x-sms-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? "50"), 200);
  const result = await drainSmsQueue(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
