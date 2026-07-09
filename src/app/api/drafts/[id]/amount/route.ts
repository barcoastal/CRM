/** Change a pending draft's amount; the delta rebalances across later drafts. */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { editDraftAmount } from "@/lib/payments/draft-mutations";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { amount?: number };
  if (typeof body.amount !== "number") return NextResponse.json({ error: "amount (number) required" }, { status: 400 });
  try {
    const res = await editDraftAmount(id, body.amount);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Edit failed" }, { status: 400 });
  }
}
