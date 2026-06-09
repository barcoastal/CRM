/**
 * Live supervisor floor: every agent currently on a call, from the always-on
 * Five9 Supervisor feed. Powers the floor dashboard (/dialer/floor).
 *
 * GET /api/dialer/floor
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
    lastEventAgoMs: s.lastEvent ? Date.now() - s.lastEvent : null,
    totalAgents: s.agents,
    onCall: s.onCall,
    calls: supervisorFeed.liveCalls(),
  });
}
