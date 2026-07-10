/** Move a pending draft to a new date. */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { rescheduleDraftDate } from "@/lib/payments/draft-mutations";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { date?: string };
    if (!body.date || Number.isNaN(Date.parse(body.date))) {
      return NextResponse.json({ error: "Valid date required" }, { status: 400 });
    }
    const res = await rescheduleDraftDate(id, new Date(body.date));
    return NextResponse.json({ ok: true, scheduledDate: res.scheduledDate.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Date change failed" }, { status: 400 });
  }
}
