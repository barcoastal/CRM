/**
 * One step in a sequence.
 *   PATCH  /api/engagement/sequences/:id/steps/:stepId
 *   DELETE /api/engagement/sequences/:id/steps/:stepId
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { validateStepConfig } from "@/lib/engagement/steps";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id, stepId } = await params;
  const body = await req.json().catch(() => ({}));

  const before = await prisma.engagementStep.findFirst({
    where: { id: stepId, sequenceId: id },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label;
  if (typeof body.order === "number") data.order = body.order;
  if (body.config !== undefined) {
    const validated = validateStepConfig(before.kind, body.config);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    data.config = validated.config as object;
  }

  const after = await prisma.engagementStep.update({ where: { id: stepId }, data });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementStep",
    entityId: stepId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return NextResponse.json(after);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id, stepId } = await params;
  const before = await prisma.engagementStep.findFirst({
    where: { id: stepId, sequenceId: id },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.engagementStep.delete({ where: { id: stepId } });
  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementStep",
    entityId: stepId,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
