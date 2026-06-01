import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { escalateCase } from "@/lib/cases";
import { escalateCaseSchema } from "@/lib/validations/case";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Escalate");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = escalateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await escalateCase({
      caseId: id,
      performedById: r.session.userId,
      reason: parsed.data.reason,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "escalation failed";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
