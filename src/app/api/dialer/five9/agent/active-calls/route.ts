/**
 * Poll the agent's active calls on Five9.
 *   GET /api/dialer/five9/agent/active-calls
 *   → { calls: [{ callId, direction, phone, state, startedAt, lead? }] }
 *
 * Used by the dialer panel to detect inbound calls and surface the matching
 * lead immediately.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCalls } from "@/lib/five9/agent-api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const calls = await getActiveCalls(session.user.id);
    // Enrich with lead context (phone match)
    const enriched = await Promise.all(
      calls.map(async (c) => {
        if (!c.phone) return { ...c, lead: null };
        const last10 = c.phone.replace(/[^0-9]/g, "").slice(-10);
        const lead = await prisma.lead.findFirst({
          where: { phone: { contains: last10 } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, contactName: true, businessName: true },
        });
        return { ...c, lead };
      }),
    );
    return NextResponse.json({ ok: true, calls: enriched });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail", calls: [] },
      { status: 502 },
    );
  }
}
