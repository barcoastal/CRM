import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { approveStep } from "@/lib/approvals/engine";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const comments = typeof body.comments === "string" ? body.comments : undefined;

  try {
    const out = await approveStep({ requestId: id, actorUserId: r.session.userId, comments });
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approve failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
