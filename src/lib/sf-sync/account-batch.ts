import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { retry } from "./reliable";

/** Import a whole account batch in one transaction. Per-record transactions
 * and closer lookups made a modest catch-up exceed the nightly deadline. */
export function accountUpsertQuery(rows: Record<string, unknown>[]) {
  if (!rows.length) throw new Error("Account batch is empty");
  const keys = Object.keys(rows[0]).filter(k => k !== "id" && k !== "createdAt" && k !== "updatedAt");
  if (!keys.includes("sfId") || !keys.includes("name") || keys.some(k => !/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) ||
      rows.some(row => keys.some(k => !(k in row)) || Object.keys(row).some(k => !keys.includes(k)))) throw new Error("Inconsistent account import fields");
  const columns = Prisma.join(keys.map(k => Prisma.raw(`"${k}"`)));
  const assignments = Prisma.join(keys.filter(k => k !== "sfId").map(k => Prisma.raw(`"${k}" = EXCLUDED."${k}"`)));
  const data = rows.map(row => ({ ...row, id: randomUUID() }));
  return Prisma.sql`
    INSERT INTO "Account" (id, ${columns}, "createdAt", "updatedAt")
    SELECT id, ${columns}, NOW(), NOW()
    FROM jsonb_populate_recordset(NULL::"Account", ${JSON.stringify(data)}::jsonb)
    ON CONFLICT ("sfId") DO UPDATE SET ${assignments}, "updatedAt" = NOW()
    RETURNING id`;
}

/** Preserve manual account access; reconcile only memberships owned by sync. */
export function accountClosersQuery(ids: string[]) {
  return Prisma.sql`
    WITH wanted AS (
      SELECT a.id AS account_id, (
        SELECT u.id FROM "User" u WHERE u."isActive" AND
          (u.id = a."sfDataJson"::jsonb->>'Closer__c' OR u."sfId" = a."sfDataJson"::jsonb->>'Closer__c')
        ORDER BY (u.id = a."sfDataJson"::jsonb->>'Closer__c') DESC, u.id LIMIT 1
      ) AS user_id FROM "Account" a WHERE a.id IN (${Prisma.join(ids)})
    ), removed AS (
      DELETE FROM "AccountTeamMember" t USING wanted w
      WHERE t."accountId" = w.account_id AND t.source = 'CLOSER_SYNC'
        AND (w.user_id IS NULL OR t."userId" <> w.user_id)
      RETURNING t.id
    )
    INSERT INTO "AccountTeamMember" (id, "accountId", "userId", role, source, "createdAt")
    SELECT 'sfsync_' || md5(account_id || ':' || user_id), account_id, user_id, 'Closer', 'CLOSER_SYNC', NOW()
    FROM wanted WHERE user_id IS NOT NULL
    ON CONFLICT ("accountId", "userId", role) DO NOTHING`;
}

export async function importAccountBatch(db: PrismaClient, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await retry(() => db.$transaction(async tx => {
    const accounts = await tx.$queryRaw<{ id: string }[]>(accountUpsertQuery(rows));
    await tx.$executeRaw(accountClosersQuery(accounts.map(a => a.id)));
  }, { maxWait: 30_000, timeout: 60_000 }));
}
