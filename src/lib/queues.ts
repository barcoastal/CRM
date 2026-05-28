import { prisma } from "@/lib/prisma";

/**
 * Salesforce-style Group/Queue model. A queue is a Group with type='QUEUE'.
 * Entities that can be queued (Lead, Case, …) reference the Group via an ownerGroupId column
 * (added in the entity's own phase). For now this module only manages the queues themselves.
 */

export const QUEUE_TYPE = "QUEUE";
export const PUBLIC_GROUP_TYPE = "PUBLIC_GROUP";
export const ROLE_GROUP_TYPE = "ROLE_GROUP";

export type GroupType = typeof QUEUE_TYPE | typeof PUBLIC_GROUP_TYPE | typeof ROLE_GROUP_TYPE;

export async function listQueues(supportedEntity?: string) {
  const queues = await prisma.group.findMany({
    where: { type: QUEUE_TYPE },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });
  if (!supportedEntity) return queues;
  return queues.filter((q) => q.supportedEntities?.split(",").map((s) => s.trim()).includes(supportedEntity));
}

export async function getQueueByDevName(developerName: string) {
  return prisma.group.findUnique({ where: { developerName } });
}

export async function listQueueMembers(developerName: string) {
  const queue = await prisma.group.findUnique({
    where: { developerName },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } } },
  });
  if (!queue || queue.type !== QUEUE_TYPE) return [];
  return queue.members.filter((m) => m.user.isActive);
}

export async function isQueueMember(userId: string, developerName: string): Promise<boolean> {
  const count = await prisma.groupMember.count({
    where: {
      userId,
      group: { developerName, type: QUEUE_TYPE },
    },
  });
  return count > 0;
}

export async function addQueueMember(developerName: string, userId: string) {
  const queue = await getQueueByDevName(developerName);
  if (!queue || queue.type !== QUEUE_TYPE) throw new Error(`Queue ${developerName} not found`);
  return prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: queue.id, userId } },
    create: { groupId: queue.id, userId },
    update: {},
  });
}

export async function removeQueueMember(developerName: string, userId: string) {
  const queue = await getQueueByDevName(developerName);
  if (!queue) return;
  await prisma.groupMember.deleteMany({ where: { groupId: queue.id, userId } });
}

/**
 * Pure helper: given a list of queues with their supportedEntities CSV,
 * filter to those that support a given entity. Useful in API routes.
 */
export function queuesForEntity<T extends { supportedEntities: string | null }>(queues: T[], entity: string): T[] {
  return queues.filter((q) => {
    if (!q.supportedEntities) return false;
    return q.supportedEntities.split(",").map((s) => s.trim()).includes(entity);
  });
}
