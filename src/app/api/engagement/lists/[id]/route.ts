/**
 * Lead List single record.
 *   GET    /api/engagement/lists/:id  (with first page of members)
 *   PATCH  /api/engagement/lists/:id
 *   DELETE /api/engagement/lists/:id
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const list = await prisma.leadList.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // First 25 members for the preview.
  const members = await prisma.leadListMember.findMany({
    where: { listId: id },
    orderBy: { addedAt: "desc" },
    take: 25,
    include: {
      lead: { select: { id: true, businessName: true, contactName: true, email: true, phone: true, status: true } },
    },
  });

  return NextResponse.json({ ...list, members });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const before = await prisma.leadList.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description == null ? null : String(body.description);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.criteria !== undefined) data.criteria = body.criteria;

  const after = await prisma.leadList.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId,
    entity: "LeadList",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });
  return NextResponse.json(after);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const before = await prisma.leadList.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.leadList.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "LeadList",
    entityId: id,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
