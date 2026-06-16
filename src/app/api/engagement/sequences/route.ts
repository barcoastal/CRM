/**
 * Engagement Sequence list + create.
 *   GET  /api/engagement/sequences
 *   POST /api/engagement/sequences
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const items = await prisma.engagementSequence.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { enrollments: true, steps: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const description = body?.description == null ? null : String(body.description);
  const entityType = String(body?.entityType ?? "Lead");
  const allowReEnroll = !!body?.allowReEnroll;
  const isActive = body?.isActive !== false;
  const entryCriteria = body?.entryCriteria ?? { kind: "and", conditions: [] };

  const seq = await prisma.engagementSequence.create({
    data: {
      name,
      description,
      entityType,
      isActive,
      allowReEnroll,
      entryCriteria: entryCriteria as object,
      createdById: r.session.userId,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementSequence",
    entityId: seq.id,
    action: "CREATE",
    after: seq as unknown as Record<string, unknown>,
  });

  return NextResponse.json(seq, { status: 201 });
}
