import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { acceptOffer } from "@/lib/settlement-acceptance";
import { acceptOfferBodySchema } from "@/lib/validations/settlement";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Settlement.Approve");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = acceptOfferBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const result = await acceptOffer(id, {
      recordType: d.recordType,
      payoffDueDate: d.payoffDueDate ? new Date(d.payoffDueDate) : null,
      notes: d.notes ?? undefined,
      approvedById: d.approvedById ?? r.session.userId,
      performedById: r.session.userId,
    });
    return NextResponse.json(result, { status: result.alreadyAccepted ? 200 : 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "accept failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
