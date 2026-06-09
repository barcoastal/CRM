/**
 * Health of the always-on Five9 Supervisor feed (for verifying it's connected
 * and seeing the live agent/on-call counts). Auth-gated.
 *
 * GET /api/dialer/five9/supervisor-status
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supervisorFeed } from "@/lib/five9/supervisor-feed";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = supervisorFeed.status;
  const base = {
    connected: s.connected,
    agents: s.agents,
    onCall: s.onCall,
    lastEventAgoMs: s.lastEvent ? Date.now() - s.lastEvent : null,
    error: s.error ?? null,
  };

  // ?debug=1 → dump what the feed actually holds, plus the current user's Five9 mapping.
  if (req.nextUrl.searchParams.get("debug")) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { five9Username: true, email: true },
    });
    const username = user?.five9Username ?? user?.email ?? "";
    return NextResponse.json({ ...base, me: { five9Username: user?.five9Username, email: user?.email, resolvedUsername: username }, debug: supervisorFeed.debugSnapshot(username) });
  }

  return NextResponse.json(base);
}
