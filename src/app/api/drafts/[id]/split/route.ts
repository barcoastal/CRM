/** Manually split a pending draft into chosen parts (SF "Edit Split"). */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { splitDraftManual } from "@/lib/payments/draft-mutations";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { parts?: Array<{ date?: string; amount?: number }> };
    const parts = (body.parts ?? [])
      .filter((p) => p.date && !Number.isNaN(Date.parse(p.date)) && typeof p.amount === "number")
      .map((p) => ({ date: new Date(p.date!), amount: p.amount! }));
    if (parts.length !== (body.parts ?? []).length || parts.length < 2) {
      return NextResponse.json({ error: "Each part needs a valid date and amount (2+ parts)" }, { status: 400 });
    }
    const res = await splitDraftManual(id, parts);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Split failed" }, { status: 400 });
  }
}
