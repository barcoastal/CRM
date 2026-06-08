import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { submitForApproval } from "@/lib/approvals/engine";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const status = url.searchParams.get("status");
  const submittedById = url.searchParams.get("submittedById");

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (status) where.status = status;
  if (submittedById) where.submittedById = submittedById;

  const items = await prisma.approvalRequest.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: {
      process: { select: { id: true, name: true, entityType: true } },
      currentStep: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true } },
    },
    take: 200,
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const processId = typeof body.processId === "string" ? body.processId : "";
  const entityType = typeof body.entityType === "string" ? body.entityType : "";
  const entityId = typeof body.entityId === "string" ? body.entityId : "";
  const comments = typeof body.comments === "string" ? body.comments : undefined;
  if (!processId || !entityType || !entityId) {
    return NextResponse.json({ error: "processId, entityType, entityId required" }, { status: 400 });
  }

  try {
    const out = await submitForApproval({
      processId,
      entityType,
      entityId,
      submitterUserId: r.session.userId,
      comments,
    });
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
