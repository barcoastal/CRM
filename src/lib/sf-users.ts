import { prisma } from "@/lib/prisma";

/**
 * Resolve raw Salesforce user ids (005...) that live inside sfDataJson
 * snapshots (Fronter/Closer/Call Transferred By lookups etc.) to the mirrored
 * CRM users, so record pages show real names instead of ids.
 */

const SF_USER_ID = /^005[a-zA-Z0-9]{12,15}$/;

export function isSfUserId(v: string | null | undefined): v is string {
  return !!v && SF_USER_ID.test(v.trim());
}

export async function resolveSfUserNames(
  values: Array<string | null | undefined>,
): Promise<Map<string, { id: string; name: string }>> {
  const ids = [...new Set(values.filter(isSfUserId).map((v) => v.trim()))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { sfId: { in: ids } },
    select: { id: true, name: true, sfId: true },
  });
  const map = new Map<string, { id: string; name: string }>();
  for (const u of users) if (u.sfId) map.set(u.sfId, { id: u.id, name: u.name });
  return map;
}
