import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Settlement.View");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const debtId = url.searchParams.get("debtId");
  const status = url.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (debtId) where.debtId = debtId;
  if (status) where.status = status;
  const items = await prisma.settlement.findMany({
    where,
    orderBy: { settledDate: "desc" },
    include: {
      debt: { include: { creditor: true } },
      offer: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}
