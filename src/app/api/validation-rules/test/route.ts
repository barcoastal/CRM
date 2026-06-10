import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import {
  evaluate,
  normalizeCondition,
  resolveFieldPath,
  OPERATORS,
} from "@/lib/validation-rules/evaluator";

const ENTITY_TYPES = ["Lead", "Opportunity", "Account", "Case", "Task", "Event"] as const;

const conditionRowSchema = z.object({
  field: z.string().min(1),
  operator: z.string().refine((v) => (OPERATORS as readonly string[]).includes(v), "invalid operator"),
  value: z.unknown().optional(),
});

const bodySchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  recordSample: z.record(z.string(), z.unknown()),
  condition: z.object({
    kind: z.enum(["and", "or"]),
    conditions: z.array(conditionRowSchema),
  }),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { recordSample, condition } = parsed.data;

  let matches: boolean;
  try {
    const norm = normalizeCondition(condition);
    matches = evaluate(norm, recordSample);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to evaluate";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Surface each row's resolved value so the builder can show authors what
  // their selectors actually pull out of the sample.
  const valueMap: Record<string, unknown> = {};
  for (const row of condition.conditions) {
    valueMap[row.field] = resolveFieldPath(recordSample, row.field) ?? null;
  }

  return NextResponse.json({ matches, valueMap });
}
