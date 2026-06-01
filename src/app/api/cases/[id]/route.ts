import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateCaseSchema } from "@/lib/validations/case";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      account: true,
      contact: true,
      programPlan: true,
      draft: true,
      owner: { select: { id: true, name: true, email: true } },
      ownerGroup: true,
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      parentCase: { select: { id: true, caseNumber: true, subject: true } },
      childCases: { select: { id: true, caseNumber: true, subject: true, status: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      tasks: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { startAt: "desc" }, take: 20 },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.case.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.slaDueAt !== undefined) data.slaDueAt = d.slaDueAt ? new Date(d.slaDueAt) : null;
  if (d.status === "IN_PROGRESS" && !before.firstResponseAt) data.firstResponseAt = new Date();

  const updated = await prisma.case.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId, entity: "Case", entityId: id, action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(updated);
}
