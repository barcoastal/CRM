import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// POST /api/files/[id]/link  — body { entityType, entityId } create link
// DELETE /api/files/[id]/link?entityType=&entityId=  — remove link
// GET /api/files/[id]/link?entityType=&entityId=     — check if linked

const ALLOWED_ENTITIES = new Set([
  "Lead",
  "Opportunity",
  "Account",
  "Contact",
  "Case",
  "Client",
  "Creditor",
  "Campaign",
  "Task",
  "Event",
  "ProgramPlan",
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (entityType && entityId) {
    const link = await prisma.contentRecordLink.findUnique({
      where: { documentId_entityType_entityId: { documentId: id, entityType, entityId } },
    });
    return NextResponse.json({ linked: !!link, link });
  }
  const links = await prisma.contentRecordLink.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    include: { linkedBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const entityType = String(body.entityType ?? "");
  const entityId = String(body.entityId ?? "");
  if (!ALLOWED_ENTITIES.has(entityType)) {
    return NextResponse.json({ error: `entityType must be one of ${[...ALLOWED_ENTITIES].join(", ")}` }, { status: 400 });
  }
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 });
  const exists = await prisma.contentDocument.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const link = await prisma.contentRecordLink.upsert({
    where: { documentId_entityType_entityId: { documentId: id, entityType, entityId } },
    create: { documentId: id, entityType, entityId, linkedById: session.userId },
    update: {},
  });
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType + entityId required" }, { status: 400 });
  }
  await prisma.contentRecordLink.deleteMany({
    where: { documentId: id, entityType, entityId },
  });
  return NextResponse.json({ ok: true });
}
