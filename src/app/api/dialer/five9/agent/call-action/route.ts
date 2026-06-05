/**
 * In-call controls: hold/unhold, mute/unmute, transfer.
 *
 *   POST /api/dialer/five9/agent/call-action
 *     body: { callId, action: "hold" | "unhold" | "mute" | "unmute" }
 *     OR    { callId, action: "transfer", destination: "+15551234567", type?: "AGENT" | "SKILL" | "EXTERNAL" }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { holdCall, muteCall, transferCall, sendDTMF } from "@/lib/five9/agent-api";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    callId?: string;
    action?: string;
    destination?: string;
    type?: "AGENT" | "SKILL" | "EXTERNAL";
    digits?: string;
  };
  if (!body.callId || !body.action) {
    return NextResponse.json({ error: "callId and action required" }, { status: 400 });
  }

  try {
    if (body.action === "hold" || body.action === "unhold") {
      await holdCall(session.user.id, body.callId, body.action);
    } else if (body.action === "mute" || body.action === "unmute") {
      await muteCall(session.user.id, body.callId, body.action);
    } else if (body.action === "transfer") {
      if (!body.destination) return NextResponse.json({ error: "destination required" }, { status: 400 });
      await transferCall(session.user.id, body.callId, { destination: body.destination, type: body.type });
    } else if (body.action === "dtmf") {
      if (!body.digits) return NextResponse.json({ error: "digits required" }, { status: 400 });
      await sendDTMF(session.user.id, body.callId, body.digits);
    } else {
      return NextResponse.json({ error: `unknown action ${body.action}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}
