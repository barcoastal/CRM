/** Skip a pending draft and push all later pending drafts forward one period. */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { skipDraft } from "@/lib/payments/draft-mutations";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  try {
    const res = await skipDraft(id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Skip failed" }, { status: 400 });
  }
}
