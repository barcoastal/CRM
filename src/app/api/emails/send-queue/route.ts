import { NextRequest, NextResponse } from "next/server";
import { drainEmailQueue } from "@/lib/email-sender";

/**
 * Cron-driven email sender. Hit every 1-5 minutes from Railway cron /
 * GitHub Actions / cron-job.org.
 *
 *   POST /api/emails/send-queue
 *   Header: x-email-secret: <EMAIL_SEND_SECRET>   (optional but recommended)
 */
export async function POST(request: NextRequest) {
  const required = process.env.EMAIL_SEND_SECRET;
  if (required) {
    const got =
      request.headers.get("x-email-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? "25"), 200);
  const result = await drainEmailQueue(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
