import { recordScope } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { z } from "zod";
import { triggerUpdateMany, makeCtx } from "@/lib/triggers/runner";
import { requireAuthOrRespond } from "@/lib/api-auth";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  assignedToId: z.string().nullable().optional(),
  status: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return ssnSafeJson({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, assignedToId, status } = parsed.data;

  const data: Record<string, unknown> = {};
  if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
  if (status !== undefined) data.status = status;
  if (Object.keys(data).length === 0) {
    return ssnSafeJson({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await triggerUpdateMany("lead",
    { id: { in: ids }, AND: [await recordScope("lead", assignedToId === undefined)] }, data, makeCtx(r.session.userId));
  return ssnSafeJson({ ok: !result.failures.length, updated: result.count, failures: result.failures,
    ...(result.failures.length ? { error: `${result.count} updated; ${result.failures.length} failed validation or automation.` } : {}) },
    { status: result.failures.length ? 400 : 200 });
}
