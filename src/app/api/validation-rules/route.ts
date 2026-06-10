import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { OPERATORS } from "@/lib/validation-rules/evaluator";

const ENTITY_TYPES = ["Lead", "Opportunity", "Account", "Case", "Task", "Event"] as const;
const FIRE_ON_VALUES = ["insert", "update", "both"] as const;

const conditionRowSchema = z.object({
  field: z.string().min(1, "field is required"),
  operator: z.string().refine((v) => (OPERATORS as readonly string[]).includes(v), "invalid operator"),
  value: z.unknown().optional(),
});

const conditionSchema = z.object({
  kind: z.enum(["and", "or"]),
  conditions: z.array(conditionRowSchema),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullish(),
  entityType: z.enum(ENTITY_TYPES),
  errorMessage: z.string().min(1).max(1000),
  errorFieldName: z.string().nullish(),
  condition: conditionSchema,
  fireOn: z.enum(FIRE_ON_VALUES).default("both"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;

  const items = await prisma.validationRule.findMany({
    where,
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const created = await prisma.validationRule.create({
    data: {
      name: d.name.trim(),
      description: d.description ?? null,
      entityType: d.entityType,
      errorMessage: d.errorMessage.trim(),
      errorFieldName: d.errorFieldName ?? null,
      condition: d.condition as unknown as never,
      fireOn: d.fireOn,
      isActive: d.isActive,
      sortOrder: d.sortOrder ?? 0,
      createdById: r.session.userId,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "ValidationRule",
    entityId: created.id,
    action: "CREATE",
    after: {
      name: created.name,
      entityType: created.entityType,
      isActive: created.isActive,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
