/** Ad-hoc "charge now" draft (next business day; obeys the $10K split rule). */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { manualCharge } from "@/lib/payments/draft-mutations";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { amount?: number; date?: string; note?: string };
  if (typeof body.amount !== "number") return NextResponse.json({ error: "amount (number) required" }, { status: 400 });
  try {
    const res = await manualCharge(id, body.amount, {
      date: body.date ? new Date(body.date) : undefined,
      note: body.note,
    });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Charge failed" }, { status: 400 });
  }
}
