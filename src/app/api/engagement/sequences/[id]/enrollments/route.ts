/**
 * Enrollments for a sequence.
 *   GET  /api/engagement/sequences/:id/enrollments?status=ACTIVE&page=1&pageSize=50
 *   POST /api/engagement/sequences/:id/enrollments  { leadId } — manual enroll
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { enrollLeadManually } from "@/lib/engagement/engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50")));

  const where: Record<string, unknown> = { sequenceId: id };
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.engagementEnrollment.findMany({
      where,
      orderBy: { enteredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.engagementEnrollment.count({ where }),
  ]);

  // Hydrate lead names for the UI.
  const leadIds = items.map((e) => e.entityId);
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, businessName: true, contactName: true, email: true },
      })
    : [];
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  return NextResponse.json({
    items: items.map((e) => ({ ...e, lead: leadMap.get(e.entityId) ?? null })),
    total,
    page,
    pageSize,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const leadId = String(body?.leadId ?? "").trim();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const result = await enrollLeadManually({ sequenceId: id, leadId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementEnrollment",
    entityId: result.enrollmentId,
    action: "CREATE",
    after: { sequenceId: id, leadId, manual: true },
  });

  return NextResponse.json({ ok: true, enrollmentId: result.enrollmentId }, { status: 201 });
}
