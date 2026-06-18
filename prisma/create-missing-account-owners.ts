/**
 * Create CRM Users for Salesforce account owners that don't exist yet, so the
 * account-ownership backfill can attribute their accounts.
 *
 *   DATABASE_URL=... npx tsx prisma/create-missing-account-owners.ts [--apply]
 *
 * Without --apply it's a DRY RUN (lists who WOULD be created, no writes).
 * Idempotent: skips any owner name that already matches a User.name.
 * Created users are INACTIVE, no login, sfId set from SF OwnerId when free.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
const APPLY = process.argv.includes("--apply");

function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 40);
}

async function main() {
  // distinct owner name + representative OwnerId + count
  const rows: { name: string | null; owner_id: string | null; cnt: number }[] = await prisma.$queryRawUnsafe(`
    SELECT (("sfDataJson"::jsonb)->>'Owner_Full_Name__c') AS name,
           MIN(("sfDataJson"::jsonb)->>'OwnerId') AS owner_id,
           COUNT(*)::int AS cnt
    FROM "Account" WHERE "sfDataJson" IS NOT NULL
      AND (("sfDataJson"::jsonb)->>'Owner_Full_Name__c') IS NOT NULL
      AND TRIM(("sfDataJson"::jsonb)->>'Owner_Full_Name__c') <> ''
    GROUP BY 1 ORDER BY cnt DESC
  `);

  const users = await prisma.user.findMany({ select: { name: true, sfId: true, email: true } });
  const existingNames = new Set(users.map((u) => u.name.toLowerCase().trim()));
  const usedSfIds = new Set(users.filter((u) => u.sfId).map((u) => u.sfId!));
  const usedEmails = new Set(users.map((u) => u.email.toLowerCase()));

  const missing = rows.filter((r) => r.name && !existingNames.has(r.name.toLowerCase().trim()));
  console.log(`${missing.length} missing owners (own ${missing.reduce((s, r) => s + r.cnt, 0)} accounts).${APPLY ? "" : "  [DRY RUN — pass --apply to create]"}\n`);

  const passwordHash = await hash(`imported-${Date.now()}-no-login`, 12);
  let created = 0;
  for (const r of missing) {
    const name = r.name!.trim();
    let email = `imported.${slug(name)}@coastaldebt.local`;
    let n = 2;
    while (usedEmails.has(email.toLowerCase())) email = `imported.${slug(name)}.${n++}@coastaldebt.local`;
    usedEmails.add(email.toLowerCase());
    const sfId = r.owner_id && !usedSfIds.has(r.owner_id) ? r.owner_id : null;
    if (sfId) usedSfIds.add(sfId);

    console.log(`  ${created + 1}. ${name.padEnd(26)} ${String(r.cnt).padStart(6)} accts  ${email}${sfId ? "  sfId=" + sfId : "  (no sfId)"}`);
    if (APPLY) {
      await prisma.user.create({
        data: { name, email, passwordHash, sfId, isActive: false, mustResetPassword: true, role: "SALES_REP" },
      });
    }
    created++;
  }
  console.log(`\n${APPLY ? `Created ${created} users.` : `Would create ${created} users. Re-run with --apply to write.`}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
