import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const Body = z.object({
  opportunityId: z.string().cuid().optional().nullable(),
  monthlyIncome: z.number().nonnegative(),
  monthlyExpenses: z.number().nonnegative(),
  totalAssets: z.number().nonnegative().optional().nullable(),
  totalLiabilities: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const items = await prisma.financialSummary.findMany({
    where: { accountId: id },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const disposableIncome = d.monthlyIncome - d.monthlyExpenses;
  const snapshot = await prisma.financialSummary.create({
    data: {
      accountId: id,
      opportunityId: d.opportunityId ?? null,
      monthlyIncome: d.monthlyIncome,
      monthlyExpenses: d.monthlyExpenses,
      disposableIncome,
      totalAssets: d.totalAssets ?? null,
      totalLiabilities: d.totalLiabilities ?? null,
      notes: d.notes ?? null,
      capturedById: r.session.userId,
    },
  });
  return NextResponse.json(snapshot, { status: 201 });
}
