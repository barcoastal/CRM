import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createProgramPlanSchema } from "@/lib/validations/program-plan";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("ProgramPlan.View");
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const status = url.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (accountId) where.accountId = accountId;
  if (status) where.status = status;

  const items = await prisma.programPlan.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, recordType: true } },
      opportunity: { select: { id: true, recordType: true } },
      processor: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { debts: true, drafts: true, fees: true } },
    },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("ProgramPlan.Create");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createProgramPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const plan = await prisma.programPlan.create({
    data: {
      ...d,
      startDate: new Date(d.startDate),
      signedDate: d.signedDate ? new Date(d.signedDate) : null,
    },
  });
  return NextResponse.json(plan, { status: 201 });
}
