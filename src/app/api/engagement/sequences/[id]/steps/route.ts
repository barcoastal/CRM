/**
 * Steps for a sequence.
 *   POST /api/engagement/sequences/:id/steps  — append a step
 *   PUT  /api/engagement/sequences/:id/steps  — bulk reorder { steps: [{id, order}] }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { STEP_KINDS, STEP_KIND_LABELS, validateStepConfig, type StepKind } from "@/lib/engagement/steps";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "");
  if (!STEP_KINDS.includes(kind as StepKind)) {
    return NextResponse.json({ error: `Unknown step kind: ${kind}` }, { status: 400 });
  }
  const label = String(body?.label ?? STEP_KIND_LABELS[kind as StepKind] ?? kind);
  const config = body?.config ?? {};
  const validated = validateStepConfig(kind, config);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  // Append to end of the list — next free order.
  const last = await prisma.engagementStep.findFirst({
    where: { sequenceId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const step = await prisma.engagementStep.create({
    data: {
      sequenceId: id,
      order: nextOrder,
      kind,
      label,
      config: validated.config as object,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementStep",
    entityId: step.id,
    action: "CREATE",
    after: step as unknown as Record<string, unknown>,
  });

  return NextResponse.json(step, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const steps = Array.isArray(body?.steps) ? body.steps : [];

  await prisma.$transaction(
    steps
      .filter((s: unknown): s is { id: string; order: number } =>
        !!s && typeof (s as { id?: unknown }).id === "string" && typeof (s as { order?: unknown }).order === "number")
      .map((s: { id: string; order: number }) =>
        prisma.engagementStep.updateMany({
          where: { id: s.id, sequenceId: id },
          data: { order: s.order },
        }),
      ),
  );

  const fresh = await prisma.engagementStep.findMany({
    where: { sequenceId: id },
    orderBy: { order: "asc" },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "EngagementSequence",
    entityId: id,
    action: "UPDATE",
    after: { steps: fresh.map((s) => ({ id: s.id, order: s.order })) },
  });

  return NextResponse.json({ items: fresh });
}
