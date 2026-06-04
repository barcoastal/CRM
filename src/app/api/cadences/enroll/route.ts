import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { enrollInCadence } from "@/lib/cadences";

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const body = await request.json().catch(() => ({}));
  const { cadenceId, leadId, opportunityId, accountId } = body ?? {};
  if (!cadenceId) return NextResponse.json({ error: "cadenceId required" }, { status: 400 });
  if (!leadId && !opportunityId && !accountId) {
    return NextResponse.json({ error: "leadId, opportunityId, or accountId required" }, { status: 400 });
  }
  try {
    const out = await enrollInCadence({
      cadenceId,
      leadId,
      opportunityId,
      accountId,
      enrolledById: r.session.userId,
    });
    return NextResponse.json({ ok: true, enrollmentId: out.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enroll failed" }, { status: 400 });
  }
}
