import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createSkipPaymentCase } from "@/lib/skip-payment";
import { skipPaymentSchema } from "@/lib/validations/case";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Case.Create");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = skipPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await createSkipPaymentCase({
      programPlanId: parsed.data.programPlanId,
      reason: parsed.data.reason,
      cancelNextDraft: parsed.data.cancelNextDraft,
      performedById: r.session.userId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "skip-payment failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
