import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { OPERATORS } from "@/lib/validation-rules/evaluator";

const ENTITY_TYPES = ["Lead", "Opportunity", "Account", "Case", "Task", "Event"] as const;
const FIRE_ON_VALUES = ["insert", "update", "both"] as const;

const conditionRowSchema = z.object({
  field: z.string().min(1),
  operator: z.string().refine((v) => (OPERATORS as readonly string[]).includes(v), "invalid operator"),
  value: z.unknown().optional(),
});

const conditionSchema = z.object({
  kind: z.enum(["and", "or"]),
  conditions: z.array(conditionRowSchema),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().nullish(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  errorMessage: z.string().min(1).max(1000).optional(),
  errorFieldName: z.string().nullish(),
  condition: conditionSchema.optional(),
  fireOn: z.enum(FIRE_ON_VALUES).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const rule = await prisma.validationRule.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.validationRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Record<string, unknown> = {};

  if (d.name !== undefined) data.name = d.name.trim();
  if (d.description !== undefined) data.description = d.description ?? null;
  if (d.entityType !== undefined) data.entityType = d.entityType;
  if (d.errorMessage !== undefined) data.errorMessage = d.errorMessage.trim();
  if (d.errorFieldName !== undefined) data.errorFieldName = d.errorFieldName ?? null;
  if (d.condition !== undefined) data.condition = d.condition;
  if (d.fireOn !== undefined) data.fireOn = d.fireOn;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;

  const updated = await prisma.validationRule.update({
    where: { id },
    data: data as never,
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "ValidationRule",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.validationRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.validationRule.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "ValidationRule",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, entityType: existing.entityType },
  });

  return NextResponse.json({ ok: true });
}
