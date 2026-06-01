import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { approveCaseSchema } from "@/lib/validations/case";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Approve");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = approveCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.case.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!before.requiresApproval) {
    return NextResponse.json({ error: "Case does not require approval" }, { status: 409 });
  }
  if (before.approvedById) {
    return NextResponse.json({ error: "Already approved" }, { status: 409 });
  }
  const updated = await prisma.case.update({
    where: { id },
    data: {
      approvedById: r.session.userId,
      approvedAt: new Date(),
      approvalNotes: parsed.data.approvalNotes ?? null,
    },
  });
  return NextResponse.json(updated);
}
