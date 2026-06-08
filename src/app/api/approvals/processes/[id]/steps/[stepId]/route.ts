import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; stepId: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { stepId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.order === "number") data.order = body.order;
  if (Array.isArray(body.criteria)) data.criteria = body.criteria as never;
  if (Array.isArray(body.approverUserIds)) {
    data.approverUserIds = (body.approverUserIds as unknown[]).map(String);
  }
  if (typeof body.useSubmitterManager === "boolean") data.useSubmitterManager = body.useSubmitterManager;
  if (typeof body.allowSkip === "boolean") data.allowSkip = body.allowSkip;

  const step = await prisma.approvalStep.update({ where: { id: stepId }, data });
  return NextResponse.json(step);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; stepId: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { stepId } = await ctx.params;
  await prisma.approvalStep.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
