import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { APPROVAL_ENTITY_TYPES } from "@/lib/approvals/engine";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;

  const items = await prisma.approvalProcess.findMany({
    where,
    orderBy: [{ entityType: "asc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" } },
      _count: { select: { requests: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const entityType = typeof body.entityType === "string" ? body.entityType : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!APPROVAL_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }

  const created = await prisma.approvalProcess.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description : null,
      entityType,
      isActive: body.isActive !== false,
      entryCriteria: (Array.isArray(body.entryCriteria) ? body.entryCriteria : []) as never,
      finalApprovalActions: (Array.isArray(body.finalApprovalActions) ? body.finalApprovalActions : []) as never,
      rejectionActions: (Array.isArray(body.rejectionActions) ? body.rejectionActions : []) as never,
      initialSubmitters: (Array.isArray(body.initialSubmitters) ? body.initialSubmitters : []) as never,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
