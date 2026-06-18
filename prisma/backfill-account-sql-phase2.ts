/**
 * Phase 2 Account backfill — client lifecycle fields from sfDataJson.
 * Set-based, chunked (5k/statement, looped), idempotent. Re-runnable.
 *
 *   DATABASE_URL=... npx tsx prisma/backfill-account-sql-phase2.ts
 *
 * Mappings (verified against the live value distributions, 2026-06-18):
 *   stage              <- Client_Status__c   (exact 8-value ACCOUNT_STAGES match)
 *   clientStatus       <- 'Cancelled' when Client_Status__c in (Cancelled, Closed Duplicate)
 *   paymentStatus      <- Payment_Status__c   (raw: "1st NSF".."4th NSF")
 *   legalStatus        <- Legal_Status__c
 *   graduatedStatus    <- Graduation_Status__c
 *   cancellationReason <- Cancellation_Reason__c
 *   cancellationDate   <- Cancellation_Date__c   (ISO date)
 *   escrowBalance      <- Escrow_Balance__c       (numeric)
 *   programStartDate   <- Program_Start_Date__c   (ISO date)
 * Skipped: Bank_Account_Status__c holds ACH return codes (R01/R08...), not a
 * clean account status — wrong semantic for the field.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);

async function chunked(label: string, sql: string) {
  let total = 0, n = 0;
  for (;;) {
    const affected = (await prisma.$executeRawUnsafe(sql)) as unknown as number;
    total += affected; n++;
    if (affected > 0) console.log(`  ${label}: +${affected} (running ${total}) [chunk ${n}]`);
    if (affected < 5000) break;
  }
  console.log(`✓ ${label}: ${total} rows updated`);
}

/** chunked string-copy: dest <- btrim(sfDataJson->>key) where present & differs */
const strCopy = (col: string, key: string) => `
  UPDATE "Account" a SET "${col}" = c.val FROM (
    SELECT id AS aid, btrim((a2."sfDataJson"::jsonb)->>'${key}') AS val
    FROM "Account" a2
    WHERE a2."sfDataJson" IS NOT NULL
      AND btrim(coalesce((a2."sfDataJson"::jsonb)->>'${key}','')) <> ''
      AND a2."${col}" IS DISTINCT FROM btrim((a2."sfDataJson"::jsonb)->>'${key}')
    LIMIT 5000
  ) c WHERE a.id = c.aid;`;

const dateCopy = (col: string, key: string) => `
  UPDATE "Account" a SET "${col}" = c.val FROM (
    SELECT id AS aid, ((a2."sfDataJson"::jsonb)->>'${key}')::timestamp AS val
    FROM "Account" a2
    WHERE a2."sfDataJson" IS NOT NULL
      AND ((a2."sfDataJson"::jsonb)->>'${key}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND a2."${col}" IS DISTINCT FROM ((a2."sfDataJson"::jsonb)->>'${key}')::timestamp
    LIMIT 5000
  ) c WHERE a.id = c.aid;`;

async function main() {
  console.log("Phase 2 SQL backfill starting...\n");

  await chunked("stage", strCopy("stage", "Client_Status__c"));

  await chunked("clientStatus(Cancelled)", `
    UPDATE "Account" a SET "clientStatus" = 'Cancelled'
    WHERE a.id IN (
      SELECT id FROM "Account" a2 WHERE a2."sfDataJson" IS NOT NULL
        AND (a2."sfDataJson"::jsonb)->>'Client_Status__c' IN ('Cancelled','Closed Duplicate')
        AND a2."clientStatus" IS DISTINCT FROM 'Cancelled'
      LIMIT 5000
    );`);

  await chunked("paymentStatus", strCopy("paymentStatus", "Payment_Status__c"));
  await chunked("legalStatus", strCopy("legalStatus", "Legal_Status__c"));
  await chunked("graduatedStatus", strCopy("graduatedStatus", "Graduation_Status__c"));
  await chunked("cancellationReason", strCopy("cancellationReason", "Cancellation_Reason__c"));
  await chunked("cancellationDate", dateCopy("cancellationDate", "Cancellation_Date__c"));
  await chunked("programStartDate", dateCopy("programStartDate", "Program_Start_Date__c"));

  await chunked("escrowBalance", `
    UPDATE "Account" a SET "escrowBalance" = c.val FROM (
      SELECT id AS aid, ((a2."sfDataJson"::jsonb)->>'Escrow_Balance__c')::double precision AS val
      FROM "Account" a2
      WHERE a2."sfDataJson" IS NOT NULL
        AND ((a2."sfDataJson"::jsonb)->>'Escrow_Balance__c') ~ '^-?[0-9]+(\\.[0-9]+)?$'
        AND a2."escrowBalance" IS DISTINCT FROM ((a2."sfDataJson"::jsonb)->>'Escrow_Balance__c')::double precision
      LIMIT 5000
    ) c WHERE a.id = c.aid;`);

  // report
  const byStage = await prisma.account.groupBy({ by: ["stage"], _count: true, orderBy: { _count: { stage: "desc" } } });
  console.log("\nstage distribution now:");
  for (const s of byStage) console.log(`  ${String(s._count).padStart(7)}  ${s.stage}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
