import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { teamOwnerIds } from "@/lib/record-access";

export type AnalyticsAccess = {
  userId: string;
  isAdmin: boolean;
  ownerIds: string[];
  permissions: string[];
};

export class AnalyticsAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Fresh authorization snapshot, never cached across requests or users. */
export async function analyticsAccess(required: string): Promise<AnalyticsAccess> {
  const session = await auth();
  if (!session?.user?.id) throw new AnalyticsAccessError(401, "Unauthorized");
  const current = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { id: true, role: true, isActive: true },
  });
  if (!current?.isActive) throw new AnalyticsAccessError(401, "Unauthorized");
  const isAdmin = current.role === "ADMIN" || current.role === "SUPER_ADMIN";
  // auth() refreshes effective permissions on every session read.
  const permissions = session.user.permissions ?? [];
  if (!isAdmin && !hasPermission(permissions, required)) throw new AnalyticsAccessError(403, "Forbidden");
  const users = isAdmin ? [] : await prisma.user.findMany({ select: { id: true, managerId: true } });
  return { userId: current.id, isAdmin, permissions, ownerIds: isAdmin ? [] : teamOwnerIds(current.id, users) };
}

export async function analyticsApiAccess(required: string): Promise<{ access: AnalyticsAccess } | { response: Response }> {
  try { return { access: await analyticsAccess(required) }; }
  catch (error) {
    if (error instanceof AnalyticsAccessError) return { response: Response.json({ error: error.message }, { status: error.status }) };
    throw error;
  }
}

export function definitionScope(access: AnalyticsAccess, edit = false): Record<string, unknown> {
  if (access.isAdmin) return {};
  return edit ? { createdById: access.userId } : { OR: [{ isShared: true }, { createdById: access.userId }] };
}

const OWNED: Record<string, { field: string; permission: string }> = {
  lead: { field: "assignedToId", permission: "Lead.View" },
  opportunity: { field: "assignedToId", permission: "Opportunity.View" },
  account: { field: "ownerId", permission: "Account.View" },
  contact: { field: "ownerId", permission: "Contact.View" },
  task: { field: "ownerId", permission: "Task.View" },
  event: { field: "ownerId", permission: "Event.View" },
  case: { field: "ownerId", permission: "Case.View" },
};

/** Unsupported objects fail closed until their ownership/sharing policy is defined. */
export function analyticsScope(access: AnalyticsAccess, model: string): Record<string, unknown> {
  if (access.isAdmin) return {};
  const rule = OWNED[model];
  if (rule) return hasPermission(access.permissions, rule.permission)
    ? { [rule.field]: { in: access.ownerIds } } : { id: { in: [] } };
  if (model === "envelope") {
    const parents = ["lead", "opportunity", "account"];
    // A signature envelope must have a visible parent, and no hidden linked parent.
    return { AND: [
      { OR: parents.map(parent => ({ [`${parent}Id`]: { not: null } })) },
      ...parents.map(parent => ({ OR: [
        { [`${parent}Id`]: null }, { [parent]: { is: analyticsScope(access, parent) } },
      ] })),
    ] };
  }
  return { id: { in: [] } };
}

export const ANALYTICS_RELATIONS: Record<string, string> = {
  account: "account", primaryContact: "contact", contact: "contact",
  opportunity: "opportunity", lead: "lead", case: "case",
};

/** Used for relation filters/sorts so hidden values cannot affect the result. */
export function visibleRelation(access: AnalyticsAccess, relation: string): Record<string, unknown> {
  return { OR: [
    { [relation]: { is: null } },
    { [relation]: { is: analyticsScope(access, ANALYTICS_RELATIONS[relation]) } },
  ] };
}

/** Mask inaccessible to-one relation projections without dropping an accessible parent. */
export async function redactAnalyticsRelations<T extends Record<string, unknown>>(
  rows: T[], relations: string[], access: AnalyticsAccess,
): Promise<T[]> {
  if (access.isAdmin) return rows;
  const result = rows.map(row => ({ ...row }));
  for (const relation of relations) {
    const model = ANALYTICS_RELATIONS[relation];
    if (!model) continue;
    const ids = [...new Set(rows.flatMap(row => {
      const nested = row[relation] as { id?: string } | null;
      return nested?.id ? [nested.id] : [];
    }))];
    if (!ids.length) {
      for (const row of result) if (row[relation]) (row as Record<string, unknown>)[relation] = null;
      continue;
    }
    const delegate = prisma[model as "account"] as unknown as {
      findMany(args: unknown): Promise<{ id: string }[]>;
    };
    const allowed = new Set((await delegate.findMany({
      where: { AND: [{ id: { in: ids } }, analyticsScope(access, model)] }, select: { id: true },
    })).map(row => row.id));
    for (const row of result) {
      const nested = row[relation] as { id?: string } | null;
      if (nested && (!nested.id || !allowed.has(nested.id))) (row as Record<string, unknown>)[relation] = null;
    }
  }
  return result;
}
