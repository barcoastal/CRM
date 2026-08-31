import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isGoogleCalendarFree } from "@/lib/google-calendar/client";
import { verifyAiToolSecret } from "@/lib/ai-dialer/tool-auth";

const schema = z.object({ startAt: z.string().datetime(), durationMinutes: z.number().int().min(15).max(120).default(30) });

export async function POST(request: NextRequest) {
  if (!verifyAiToolSecret(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  const start = new Date(parsed.data.startAt);
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);
  if (start.getTime() < Date.now()) return NextResponse.json({ available: false, reason: "Time is in the past" });
  return NextResponse.json({ available: await isGoogleCalendarFree(start, end), startAt: start, endAt: end });
}
