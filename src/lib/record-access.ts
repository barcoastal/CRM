import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ownedRecordScope } from "@/lib/owned-record-scope";
import { prisma } from "@/lib/prisma";

export type OwnedEntity = "lead" | "opportunity" | "account" | "contact";
export const OWNER_FIELD = { lead: "assignedToId", opportunity: "assignedToId", account: "ownerId", contact: "ownerId" } as const;

/** Explicit reporting lines define teams. Missing managers never grant access. */
export function teamOwnerIds(userId: string, users: { id: string; managerId: string | null }[]): string[] {
  const result = new Set([userId]);
  let frontier = [userId];
  while (frontier.length) {
    const managers = new Set(frontier);
    frontier = users.filter(u => u.managerId && managers.has(u.managerId) && !result.has(u.id)).map(u => u.id);
    for (const id of frontier) result.add(id);
  }
  return [...result];
}

export async function recordScope(entity: OwnedEntity, includeNegotiator = true): Promise<Record<string, unknown>> {
  const session = await auth();
  if (!session?.user?.id) return { id: { in: [] } };
  // Use current database state, including when called outside the normal layout.
  const current = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { id: true, role: true, isActive: true },
  });
  if (!current?.isActive) return { id: { in: [] } };
  if (current.role === "ADMIN" || current.role === "SUPER_ADMIN") return {};
  const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
  // Having actual reports, rather than a loosely named profile, defines a manager.
  // Include indirect reports; cycles terminate through the visited set.
  const scope=ownedRecordScope(entity, teamOwnerIds(current.id, users), includeNegotiator && hasPermission(session.user.permissions ?? [], entity === "account" ? "Account.View" : "Opportunity.View"));
  if(entity==='account'&&includeNegotiator&&hasPermission(session.user.permissions??[], 'Account.View'))return {OR:[scope,{teamMembers:{some:{userId:current.id}}}]};
  return scope;
}

/** Guard parent-record subroutes before reading documents or running actions. */
export async function canAccessRecord(entity: OwnedEntity, id: string): Promise<boolean> {
  const scope = await recordScope(entity);
  const delegate = prisma[entity] as unknown as {
    findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string } | null>;
  };
  return !!await delegate.findFirst({ where: { id, AND: [scope] }, select: { id: true } });
}
