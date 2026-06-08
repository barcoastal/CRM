import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { rejectRequest } from "@/lib/approvals/engine";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const comments = typeof body.comments === "string" ? body.comments : "";
  if (!comments.trim()) {
    return NextResponse.json({ error: "Rejection comments are required" }, { status: 400 });
  }

  try {
    const out = await rejectRequest({ requestId: id, actorUserId: r.session.userId, comments });
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reject failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
