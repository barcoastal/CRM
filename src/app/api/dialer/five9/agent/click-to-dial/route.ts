/**
 * Click-to-dial. Place a call through Five9 on behalf of the agent — Five9
 * rings the agent's station, then dials the destination.
 *
 *   POST /api/dialer/five9/agent/click-to-dial
 *     { number: "+19048810033", leadId?: "...", campaignId?: "...", skillId?: "..." }
 *
 * Records a Call row in the CRM with direction=OUTBOUND, status=INITIATED,
 * five9CallId for matching the Five9 webhook event that comes back later.
 *
 * Auth: any logged-in user with Lead.Read.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeCall } from "@/lib/five9/agent-api";
import { isSuppressed, normalizePhone } from "@/lib/dnc";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    number?: string;
    leadId?: string;
    campaignId?: string;
    skillId?: string;
  };
  if (!body.number) return NextResponse.json({ error: "number required" }, { status: 400 });

  // DNC suppression check
  const normalized = normalizePhone(body.number);
  const suppressed = await isSuppressed(normalized);
  if (suppressed) {
    return NextResponse.json({ error: "Phone is on DNC list" }, { status: 403 });
  }

  try {
    const result = await makeCall(session.user.id, {
      number: body.number,
      campaignId: body.campaignId,
      skillId: body.skillId,
    });

    // Log the dial attempt as a Call row so the dialer panel shows it
    // immediately, even before the Five9 webhook fires.
    const call = await prisma.call.create({
      data: {
        direction: "OUTBOUND",
        status: "INITIATED",
        leadId: body.leadId ?? null,
        agentId: session.user.id,
        phoneNumber: body.number,
        startedAt: new Date(),
        five9CallId: result.callId ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, callId: result.callId, crmCallId: call.id });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }
}
