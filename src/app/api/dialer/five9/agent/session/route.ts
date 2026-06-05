/**
 * Five9 agent session lifecycle.
 *
 *   POST /api/dialer/five9/agent/session
 *     body: { stationId?: string }
 *     → starts agent session in Five9 (login + session_start)
 *
 *   GET /api/dialer/five9/agent/session
 *     → current session state from Five9
 *
 *   DELETE /api/dialer/five9/agent/session
 *     → logs the agent out of Five9
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startAgentSession, getAgentSessionState, logoutAgent } from "@/lib/five9/agent-api";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9StationId: true, five9StationType: true },
  });
  const stationId = (body as { stationId?: string }).stationId ?? user?.five9StationId ?? "";
  const stationType = ((body as { stationType?: string }).stationType ??
    user?.five9StationType ??
    "EMPTY") as "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN";
  try {
    await startAgentSession(session.user.id, stationId, stationType);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const state = await getAgentSessionState(session.user.id);
    return NextResponse.json({ ok: true, ...state });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await logoutAgent(session.user.id);
  return NextResponse.json({ ok: true });
}
