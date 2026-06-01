import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateProgramPlanSchema } from "@/lib/validations/program-plan";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("ProgramPlan.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const plan = await prisma.programPlan.findUnique({
    where: { id },
    include: {
      account: true,
      opportunity: true,
      processor: true,
      assignedTo: { select: { id: true, name: true } },
      debts: { include: { creditor: true } },
      debitSchedules: true,
      drafts: { orderBy: { scheduledDate: "desc" }, take: 50 },
      fees: { orderBy: { chargedDate: "desc" }, take: 50 },
    },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("ProgramPlan.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateProgramPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.programPlan.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.startDate) data.startDate = new Date(d.startDate);
  if (d.signedDate) data.signedDate = new Date(d.signedDate);

  const plan = await prisma.programPlan.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId, entity: "ProgramPlan", entityId: id, action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: plan as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(plan);
}
