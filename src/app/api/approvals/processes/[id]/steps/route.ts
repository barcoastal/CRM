import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const items = await prisma.approvalStep.findMany({
    where: { processId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const process = await prisma.approvalProcess.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "desc" }, take: 1 } },
  });
  if (!process) return NextResponse.json({ error: "Process not found" }, { status: 404 });

  const nextOrder = (process.steps[0]?.order ?? 0) + 1;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `Step ${nextOrder}`;

  const step = await prisma.approvalStep.create({
    data: {
      processId: id,
      order: typeof body.order === "number" ? body.order : nextOrder,
      name,
      criteria: (Array.isArray(body.criteria) ? body.criteria : []) as never,
      approverUserIds: Array.isArray(body.approverUserIds)
        ? (body.approverUserIds as unknown[]).map(String)
        : [],
      useSubmitterManager: Boolean(body.useSubmitterManager),
      allowSkip: Boolean(body.allowSkip),
    },
  });
  return NextResponse.json(step, { status: 201 });
}
