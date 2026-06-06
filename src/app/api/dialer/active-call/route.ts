/**
 * Returns the logged-in agent's current active (in-progress) call so the
 * dialer can screen-pop the matching lead in THIS CRM.
 *
 * Source is the Call table populated by the Five9 webhook (server-to-server),
 * NOT the agent REST API — polling the agent API would ForceIn-kick the
 * agent's embedded Agent Desktop session.
 *
 * GET /api/dialer/active-call
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only consider very recent rows so a stale call doesn't keep popping.
  const since = new Date(Date.now() - 10 * 60 * 1000); // 10 min
  const call = await prisma.call.findFirst({
    where: {
      agentId: session.user.id,
      status: { in: ["INITIATED", "IN_PROGRESS"] },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, phoneNumber: true, leadId: true, startedAt: true },
  });

  if (!call) return NextResponse.json({ active: false });
  return NextResponse.json({
    active: true,
    callId: call.id,
    phone: call.phoneNumber,
    leadId: call.leadId,
    startedAt: call.startedAt,
  });
}
