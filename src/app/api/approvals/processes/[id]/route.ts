import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { APPROVAL_ENTITY_TYPES } from "@/lib/approvals/engine";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const item = await prisma.approvalProcess.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) data.description = body.description;
  if (typeof body.entityType === "string") {
    if (!APPROVAL_ENTITY_TYPES.includes(body.entityType)) {
      return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
    }
    data.entityType = body.entityType;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Array.isArray(body.entryCriteria)) data.entryCriteria = body.entryCriteria as never;
  if (Array.isArray(body.finalApprovalActions)) data.finalApprovalActions = body.finalApprovalActions as never;
  if (Array.isArray(body.rejectionActions)) data.rejectionActions = body.rejectionActions as never;
  if (Array.isArray(body.initialSubmitters)) data.initialSubmitters = body.initialSubmitters as never;

  const updated = await prisma.approvalProcess.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  await prisma.approvalProcess.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
