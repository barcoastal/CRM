import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

/**
 * Pure helper: compute the field-level diff between two records.
 * Returns { before, after } objects containing only the changed fields.
 * Useful so we don't store full row dumps when only one field changed.
 */
export function diffRecords<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  if (!before && !after) return { before: b, after: a };
  if (!before) return { before: b, after: { ...(after as T) } };
  if (!after) return { before: { ...(before as T) }, after: a };

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const bv = before[k];
    const av = after[k];
    if (!isEqual(bv, av)) {
      b[k as keyof T] = bv as T[keyof T];
      a[k as keyof T] = av as T[keyof T];
    }
  }
  return { before: b, after: a };
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface AuditArgs {
  userId?: string | null;
  entity: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** When true, only the diff is stored in before/after. Defaults to true. */
  diffOnly?: boolean;
}

export async function auditWrite(args: AuditArgs) {
  const diffOnly = args.diffOnly !== false;
  let before = args.before ?? null;
  let after = args.after ?? null;
  if (diffOnly && (before || after)) {
    const d = diffRecords(before, after);
    before = Object.keys(d.before).length ? d.before : null;
    after = Object.keys(d.after).length ? d.after : null;
  }
  // Skip no-op UPDATEs (nothing changed)
  if (args.action === "UPDATE" && !before && !after) return null;

  return prisma.auditLog.create({
    data: {
      userId: args.userId ?? null,
      entity: args.entity,
      entityId: args.entityId,
      action: args.action,
      ...(before ? { before: before as object } : {}),
      ...(after ? { after: after as object } : {}),
    },
  });
}

export async function getAuditLog(entity: string, entityId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
