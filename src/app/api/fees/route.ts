import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Fee.View");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const programPlanId = url.searchParams.get("programPlanId");
  const status = url.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (programPlanId) where.programPlanId = programPlanId;
  if (status) where.status = status;
  const items = await prisma.fee.findMany({
    where,
    orderBy: { chargedDate: "desc" },
    include: {
      programPlan: { select: { id: true, accountId: true } },
      chargedBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}
