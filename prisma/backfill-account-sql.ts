/**
 * Phase 1 Account backfill — set-based SQL (chunked 5k rows/statement, looped).
 * Idempotent: every chunk only touches rows whose value still differs, so it can
 * be re-run safely and resumes wherever a prior run left off.
 *
 *   DATABASE_URL=... npx tsx prisma/backfill-account-sql.ts
 *
 * Mirrors the validated dry-run logic in src/lib/sf-account-backfill.ts
 * (ownership by Owner_Full_Name__c -> User.name; flags/debt/billing from sfDataJson).
 */
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function chunked(label: string, sql: string) {
  let totalRows = 0, n = 0;
  for (;;) {
    const affected = (await prisma.$executeRawUnsafe(sql)) as unknown as number;
    totalRows += affected;
    n++;
    if (affected > 0) console.log(`  ${label}: +${affected} (running ${totalRows}) [chunk ${n}]`);
    if (affected < 5000) break;
  }
  console.log(`✓ ${label}: ${totalRows} rows updated`);
}

async function main() {
  console.log("Phase 1 SQL backfill starting...\n");

  // 1. ownerId — by Owner_Full_Name__c -> User.name (deduped to one user per name)
  await chunked("ownerId", `
    UPDATE "Account" a SET "ownerId" = c.uid
    FROM (
      SELECT a2.id AS aid, umap.id AS uid
      FROM "Account" a2
      JOIN (
        SELECT DISTINCT ON (lower(btrim(name))) lower(btrim(name)) AS lname, id
        FROM "User" ORDER BY lower(btrim(name)), id
      ) umap ON lower(btrim((a2."sfDataJson"::jsonb)->>'Owner_Full_Name__c')) = umap.lname
      WHERE a2."sfDataJson" IS NOT NULL AND a2."ownerId" IS DISTINCT FROM umap.id
      LIMIT 5000
    ) c WHERE a.id = c.aid;`);

  // 2. currentTotalDebt — Total_Debt__c (numeric only)
  await chunked("currentTotalDebt", `
    UPDATE "Account" a SET "currentTotalDebt" = c.val
    FROM (
      SELECT id AS aid, ((a2."sfDataJson"::jsonb)->>'Total_Debt__c')::double precision AS val
      FROM "Account" a2
      WHERE a2."sfDataJson" IS NOT NULL
        AND ((a2."sfDataJson"::jsonb)->>'Total_Debt__c') ~ '^-?[0-9]+(\\.[0-9]+)?$'
        AND a2."currentTotalDebt" IS DISTINCT FROM ((a2."sfDataJson"::jsonb)->>'Total_Debt__c')::double precision
      LIMIT 5000
    ) c WHERE a.id = c.aid;`);

  // 3. highUccRisk — HIGH_UCC_RISK__c = true
  await chunked("highUccRisk", `
    UPDATE "Account" a SET "highUccRisk" = true
    WHERE a.id IN (
      SELECT id FROM "Account" a2
      WHERE a2."sfDataJson" IS NOT NULL
        AND lower((a2."sfDataJson"::jsonb)->>'HIGH_UCC_RISK__c') IN ('true','1','yes')
        AND a2."highUccRisk" IS DISTINCT FROM true
      LIMIT 5000
    );`);

  // 4. qualifiedStatus — Qualified_Financial__c = true -> 'Qualified'
  await chunked("qualifiedStatus", `
    UPDATE "Account" a SET "qualifiedStatus" = 'Qualified'
    WHERE a.id IN (
      SELECT id FROM "Account" a2
      WHERE a2."sfDataJson" IS NOT NULL
        AND lower((a2."sfDataJson"::jsonb)->>'Qualified_Financial__c') IN ('true','1','yes')
        AND a2."qualifiedStatus" IS DISTINCT FROM 'Qualified'
      LIMIT 5000
    );`);

  // 5. billing city / street / zip (small)
  for (const [col, key] of [["billingCity", "BillingCity"], ["billingStreet", "BillingStreet"], ["billingZip", "BillingPostalCode"]] as const) {
    await chunked(col, `
      UPDATE "Account" a SET "${col}" = c.val
      FROM (
        SELECT id AS aid, btrim((a2."sfDataJson"::jsonb)->>'${key}') AS val
        FROM "Account" a2
        WHERE a2."sfDataJson" IS NOT NULL
          AND btrim(coalesce((a2."sfDataJson"::jsonb)->>'${key}','')) <> ''
          AND a2."${col}" IS DISTINCT FROM btrim((a2."sfDataJson"::jsonb)->>'${key}')
        LIMIT 5000
      ) c WHERE a.id = c.aid;`);
  }

  const owned = await prisma.account.count({ where: { ownerId: { not: null } } });
  console.log(`\nDone. Accounts with an owner now: ${owned.toLocaleString()}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
