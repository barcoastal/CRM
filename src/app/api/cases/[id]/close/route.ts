import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closeCase } from "@/lib/cases";
import { closeCaseSchema } from "@/lib/validations/case";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Close");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = closeCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await closeCase({
    caseId: id,
    outcome: parsed.data.outcome,
    resolutionNote: parsed.data.resolutionNote,
    performedById: r.session.userId,
  });
  return NextResponse.json(result);
}
