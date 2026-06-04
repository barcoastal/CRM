/**
 * Change agent ready state.
 *   PUT /api/dialer/five9/agent/state  { state: "READY" | "NOT_READY", reasonCodeId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setAgentState } from "@/lib/five9/agent-api";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { state?: string; reasonCodeId?: string };
  if (!body.state) return NextResponse.json({ error: "state required" }, { status: 400 });
  try {
    await setAgentState(session.user.id, body.state, body.reasonCodeId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}
