/**
 * Health of the always-on Five9 Supervisor feed (for verifying it's connected
 * and seeing the live agent/on-call counts). Auth-gated.
 *
 * GET /api/dialer/five9/supervisor-status
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supervisorFeed } from "@/lib/five9/supervisor-feed";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = supervisorFeed.status;
  return NextResponse.json({
    connected: s.connected,
    agents: s.agents,
    onCall: s.onCall,
    lastEventAgoMs: s.lastEvent ? Date.now() - s.lastEvent : null,
    error: s.error ?? null,
  });
}
