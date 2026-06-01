import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createCaseCommentSchema } from "@/lib/validations/case";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const comments = await prisma.caseComment.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items: comments });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = createCaseCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const comment = await prisma.caseComment.create({
    data: { caseId: id, body: parsed.data.body, isInternal: parsed.data.isInternal, authorId: r.session.userId },
  });
  // First-response tracking on the case
  await prisma.case.update({
    where: { id },
    data: {
      firstResponseAt: { set: undefined } as never, // skip update if already set; handled below
    },
  }).catch(() => null);
  const c = await prisma.case.findUnique({ where: { id }, select: { firstResponseAt: true } });
  if (c && !c.firstResponseAt) {
    await prisma.case.update({ where: { id }, data: { firstResponseAt: new Date() } });
  }
  return NextResponse.json(comment, { status: 201 });
}
