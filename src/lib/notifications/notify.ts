/**
 * Notify helper, drops one Notification row per recipient. Fire-and-forget,
 * we NEVER throw, so callers can `void notify(...)` after their primary write
 * without rolling back when the bell-icon DB hop fails.
 *
 * Two call shapes are supported:
 *   notify({ recipientId, kind, title, ... })          // single recipient
 *   notify({ recipientIds: [...], kind, title, ... })  // bulk (legacy alias)
 *   notifyMany(["u1","u2"], { kind, title, ... })      // bulk, preferred
 *
 * Optional flags:
 *   skipIfSelf — drops the recipient when recipientId equals actorId. Use this
 *                so a user who reassigns a record to themselves does not get
 *                notified about their own action.
 */

import { prisma } from "@/lib/prisma";

export type NotifyKind =
  | "OWNER_ASSIGNED"
  | "MENTION"
  | "APPROVAL_REQUEST"
  | "APPROVAL_DECIDED"
  | "ENVELOPE_SIGNED"
  | "MASS_EMAIL_DONE"
  | "TASK_DUE"
  | "LEAD_INBOUND"
  | "GENERIC";

export interface NotifyOpts {
  recipientId: string;
  kind: NotifyKind | string;
  title: string;
  body?: string | null;
  url?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  /** Skip if recipient equals actor. Avoids notifying your own action. */
  skipIfSelf?: boolean;
}

/** Bulk-style input. Kept compatible with existing call sites (Chatter). */
export interface NotifyBulkOpts {
  recipientIds: string[];
  kind: NotifyKind | string;
  title: string;
  body?: string | null;
  url?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  skipIfSelf?: boolean;
}

type NotifyRest = Omit<NotifyOpts, "recipientId">;

function isBulk(o: NotifyOpts | NotifyBulkOpts): o is NotifyBulkOpts {
  return Array.isArray((o as NotifyBulkOpts).recipientIds);
}

/**
 * Insert one Notification row. Accepts the single-recipient shape OR the bulk
 * shape (delegates to notifyMany). Never throws.
 */
export async function notify(opts: NotifyOpts | NotifyBulkOpts): Promise<void> {
  if (isBulk(opts)) {
    await notifyMany(opts.recipientIds, opts);
    return;
  }
  const recipientId = opts.recipientId;
  if (!recipientId) return;
  if (opts.skipIfSelf && opts.actorId && opts.actorId === recipientId) return;
  try {
    await prisma.notification.create({
      data: {
        recipientId,
        kind: String(opts.kind),
        title: opts.title,
        body: opts.body ?? null,
        url: opts.url ?? null,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        actorId: opts.actorId ?? null,
      },
    });
  } catch (err) {
    // Swallow, fire-and-forget. Visible only in server logs.
    console.error("[notify] insert failed", err);
  }
}

/**
 * Fire-and-forget bulk insert. Dedupes recipientIds, applies skipIfSelf.
 * Never throws.
 */
export async function notifyMany(
  recipientIds: string[],
  rest: NotifyRest,
): Promise<void> {
  if (!recipientIds || recipientIds.length === 0) return;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of recipientIds) {
    if (!id) continue;
    if (rest.skipIfSelf && rest.actorId && id === rest.actorId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: ids.map((recipientId) => ({
        recipientId,
        kind: String(rest.kind),
        title: rest.title,
        body: rest.body ?? null,
        url: rest.url ?? null,
        entityType: rest.entityType ?? null,
        entityId: rest.entityId ?? null,
        actorId: rest.actorId ?? null,
      })),
    });
  } catch (err) {
    console.error("[notifyMany] createMany failed, falling back per-row", err);
    for (const recipientId of ids) {
      try {
        await prisma.notification.create({
          data: {
            recipientId,
            kind: String(rest.kind),
            title: rest.title,
            body: rest.body ?? null,
            url: rest.url ?? null,
            entityType: rest.entityType ?? null,
            entityId: rest.entityId ?? null,
            actorId: rest.actorId ?? null,
          },
        });
      } catch {
        // ignore
      }
    }
  }
}
