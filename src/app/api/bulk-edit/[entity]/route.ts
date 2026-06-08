import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import {
  ALLOWED_BULK_FIELDS,
  ENTITY_LABEL,
  PRISMA_MODEL_FOR,
  isBulkEntity,
  pickAllowedPatch,
  type BulkEntity,
} from "@/lib/lists/allowed-bulk-fields";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  patch: z.record(z.string(), z.unknown()).optional(),
  delete: z.boolean().optional(),
});

/**
 * Bulk-edit endpoint. Used both by:
 *   1) the bulk action bar — POST /api/bulk-edit/<entity> with N ids
 *   2) the inline-edit cell — same endpoint, ids=[singleId], one field in patch
 *
 * Validation: entity must be allowlisted, patch keys must be in
 * ALLOWED_BULK_FIELDS for that entity, and ids count must be 1..1000.
 *
 * On success we write a single audit row capturing the op summary (count +
 * fields changed). Per-record diff audit is intentionally skipped to keep
 * the audit log small on big bulk updates.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ entity: string }> },
) {
  const { entity } = await ctx.params;
  if (!isBulkEntity(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  const e = entity as BulkEntity;

  // Require Edit permission for the entity (matches existing per-entity
  // bulk-update endpoints).
  const permName = `${ENTITY_LABEL[e]}.Edit`;
  const r = await requireAuthOrRespond(permName);
  if ("response" in r) return r.response;
  const { session } = r;

  // Optional ?singleId=<id> query param for the inline-edit single-record
  // path. When present it overrides ids in the body.
  const url = new URL(req.url);
  const singleId = url.searchParams.get("singleId");

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse({
    ...body,
    ids: singleId ? [singleId] : body.ids,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, patch, delete: doDelete } = parsed.data;

  const modelKey = PRISMA_MODEL_FOR[e];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[modelKey];
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 500 });
  }

  if (doDelete) {
    // No soft-delete columns in the current schema -> hard delete.
    let deletedCount = 0;
    try {
      const result = await model.deleteMany({ where: { id: { in: ids } } });
      deletedCount = result.count;
    } catch (err) {
      // Most likely a FK violation. Surface a clear error.
      const msg = err instanceof Error ? err.message : "Delete failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    await auditWrite({
      userId: session.userId,
      entity: ENTITY_LABEL[e],
      entityId: ids[0],
      action: "DELETE",
      after: { bulkDelete: true, count: deletedCount, ids: ids.slice(0, 50) },
      diffOnly: false,
    });
    return NextResponse.json({ ok: true, deleted: deletedCount });
  }

  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, rejected } = pickAllowedPatch(e, patch);
  if (rejected.length > 0) {
    return NextResponse.json({
      error: `Field(s) not allowed for bulk update: ${rejected.join(", ")}`,
      allowed: ALLOWED_BULK_FIELDS[e],
    }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  let updatedCount = 0;
  try {
    const result = await model.updateMany({
      where: { id: { in: ids } },
      data,
    });
    updatedCount = result.count;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await auditWrite({
    userId: session.userId,
    entity: ENTITY_LABEL[e],
    entityId: ids[0],
    action: "UPDATE",
    after: { bulkUpdate: true, count: updatedCount, fields: Object.keys(data), ids: ids.slice(0, 50) },
    diffOnly: false,
  });

  return NextResponse.json({ ok: true, updated: updatedCount });
}
