/**
 * Hang up an active Five9 call.
 *   POST /api/dialer/five9/agent/hangup  { callId: "..." }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hangupCall } from "@/lib/five9/agent-api";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { callId?: string };
  if (!body.callId) return NextResponse.json({ error: "callId required" }, { status: 400 });
  try {
    await hangupCall(session.user.id, body.callId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}
