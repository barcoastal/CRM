import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { recallRequest } from "@/lib/approvals/engine";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  try {
    const out = await recallRequest({ requestId: id, actorUserId: r.session.userId });
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recall failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
