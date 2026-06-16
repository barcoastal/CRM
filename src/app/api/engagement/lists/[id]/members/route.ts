/**
 * Members of a Lead List.
 *   GET    /api/engagement/lists/:id/members?page=1&pageSize=50
 *   POST   /api/engagement/lists/:id/members  { leadId | leadIds: [] }
 *   DELETE /api/engagement/lists/:id/members  { leadId | leadIds: [] }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50")));

  const [items, total] = await Promise.all([
    prisma.leadListMember.findMany({
      where: { listId: id },
      orderBy: { addedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lead: { select: { id: true, businessName: true, contactName: true, email: true, phone: true, status: true } },
      },
    }),
    prisma.leadListMember.count({ where: { listId: id } }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

function asIds(body: { leadId?: unknown; leadIds?: unknown }): string[] {
  if (Array.isArray(body.leadIds)) return body.leadIds.filter((x): x is string => typeof x === "string");
  if (typeof body.leadId === "string") return [body.leadId];
  return [];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const leadIds = asIds(body);
  if (leadIds.length === 0) return NextResponse.json({ error: "leadId or leadIds required" }, { status: 400 });

  let added = 0;
  for (const leadId of leadIds) {
    try {
      await prisma.leadListMember.upsert({
        where: { listId_leadId: { listId: id, leadId } },
        create: { listId: id, leadId, source: "manual" },
        update: {},
      });
      added++;
    } catch {
      // skip silently
    }
  }

  await auditWrite({
    userId: r.session.userId,
    entity: "LeadList",
    entityId: id,
    action: "UPDATE",
    after: { added, leadIds },
  });

  return NextResponse.json({ ok: true, added }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const leadIds = asIds(body);
  if (leadIds.length === 0) return NextResponse.json({ error: "leadId or leadIds required" }, { status: 400 });

  const removed = await prisma.leadListMember.deleteMany({
    where: { listId: id, leadId: { in: leadIds } },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "LeadList",
    entityId: id,
    action: "UPDATE",
    after: { removed: removed.count, leadIds },
  });

  return NextResponse.json({ ok: true, removed: removed.count });
}
