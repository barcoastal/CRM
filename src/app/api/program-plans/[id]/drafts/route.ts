import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createDraftSchema } from "@/lib/validations/draft";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const drafts = await prisma.draft.findMany({
    where: { programPlanId: id },
    orderBy: { scheduledDate: "desc" },
    include: { debitSchedule: { select: { id: true, frequency: true } } },
  });
  return NextResponse.json({ items: drafts });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = createDraftSchema.safeParse({ ...body, programPlanId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const draft = await prisma.draft.create({
    data: { ...d, scheduledDate: new Date(d.scheduledDate) },
  });
  return NextResponse.json(draft, { status: 201 });
}
