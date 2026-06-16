/**
 * Engagement Sequence single record.
 *   GET    /api/engagement/sequences/:id
 *   PATCH  /api/engagement/sequences/:id
 *   DELETE /api/engagement/sequences/:id
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
  const seq = await prisma.engagementSequence.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [active, paused, completed, exited] = await Promise.all([
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "ACTIVE" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "PAUSED" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "COMPLETED" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "EXITED" } }),
  ]);

  return NextResponse.json({ ...seq, stats: { active, paused, completed, exited } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const before = await prisma.engagementSequence.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description == null ? null : String(body.description);
  if (typeof body.entityType === "string") data.entityType = body.entityType;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.allowReEnroll === "boolean") data.allowReEnroll = body.allowReEnroll;
  if (typeof body.maxEnrollsPerTick === "number") data.maxEnrollsPerTick = Math.max(1, Math.floor(body.maxEnrollsPerTick));
  if (body.entryCriteria !== undefined) data.entryCriteria = body.entryCriteria;

  const after = await prisma.engagementSequence.update({ where: { id }, data });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementSequence",
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
  const before = await prisma.engagementSequence.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.engagementSequence.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementSequence",
    entityId: id,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
