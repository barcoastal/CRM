/**
 * Phase 1 Account field backfill from sfDataJson (ownership + flags + basics).
 *
 *   DATABASE_URL=... npx tsx prisma/backfill-account-fields.ts          # DRY RUN
 *   DATABASE_URL=... npx tsx prisma/backfill-account-fields.ts --apply  # writes
 *
 * Dry run reports, per field, how many accounts WOULD change (and how many
 * owners resolve / don't). Idempotent: only writes fields whose value differs.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildPhase1Patch, PHASE1_FIELDS, type SfRow, type AccountPatch } from "../src/lib/sf-account-backfill";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as any);
const APPLY = process.argv.includes("--apply");
const BATCH = 2000;

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, sfId: true } });
  const byName = new Map(users.map((u) => [u.name.toLowerCase().trim(), u.id]));
  const bySfId = new Map(users.filter((u) => u.sfId).map((u) => [u.sfId!, u.id]));
  const resolvers = {
    byName: (n: string) => byName.get(n.trim()),
    bySfId: (s: string) => bySfId.get(s),
  };

  const total = await prisma.account.count({ where: { sfDataJson: { not: null } } });
  console.log(`${total} accounts with sfDataJson. ${APPLY ? "APPLYING writes." : "DRY RUN (no writes)."}\n`);

  const changed: Record<string, number> = Object.fromEntries(PHASE1_FIELDS.map((f) => [f, 0]));
  let processed = 0, ownerUnresolved = 0, ownerNoName = 0, rowsWithAnyChange = 0, applied = 0;
  const samples: string[] = [];

  let pending: { id: string; diff: AccountPatch }[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    // Bounded-concurrency parallel updates (no transaction — idempotent re-runnable).
    const CONC = 25;
    for (let i = 0; i < batch.length; i += CONC) {
      await Promise.all(batch.slice(i, i + CONC).map((p) => prisma.account.update({ where: { id: p.id }, data: p.diff })));
      applied += Math.min(CONC, batch.length - i);
    }
  };

  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.account.findMany({
      where: { sfDataJson: { not: null } },
      select: {
        id: true, name: true, sfDataJson: true,
        ownerId: true, highUccRisk: true, feePaidInFull: true, qualifiedStatus: true,
        currentTotalDebt: true, industry: true, phone: true,
        billingState: true, billingCity: true, billingStreet: true, billingZip: true,
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!page.length) break;
    cursor = page[page.length - 1].id;

    for (const a of page) {
      processed++;
      let sf: SfRow;
      try { sf = JSON.parse(a.sfDataJson!) as SfRow; } catch { continue; }
      const patch = buildPhase1Patch(sf, resolvers);

      // owner resolution tally
      const ownerName = (sf.Owner_Full_Name__c ? String(sf.Owner_Full_Name__c).trim() : "");
      if (!ownerName) ownerNoName++;
      else if (!patch.ownerId) ownerUnresolved++;

      // compute real diffs vs current
      const diff: AccountPatch = {};
      let any = false;
      for (const f of PHASE1_FIELDS) {
        if (!(f in patch)) continue;
        const next = patch[f as keyof AccountPatch];
        const cur = (a as Record<string, unknown>)[f];
        if (next !== cur && !(cur == null && next == null)) {
          (diff as Record<string, unknown>)[f] = next;
          changed[f]++;
          any = true;
        }
      }
      if (any) {
        rowsWithAnyChange++;
        if (samples.length < 5) samples.push(`  ${a.name}: ${JSON.stringify(diff)}`);
        if (APPLY) {
          pending.push({ id: a.id, diff });
          if (pending.length >= 500) await flush();
        }
      }
    }
    if (processed % 20000 < BATCH) console.log(`  ...processed ${processed}/${total} (applied ${applied})`);
  }
  if (APPLY) await flush();

  console.log(`\nProcessed ${processed}. Rows with ≥1 change: ${rowsWithAnyChange}.${APPLY ? ` Applied ${applied}.` : ""}`);
  console.log(`\nWould-change counts per field:`);
  for (const f of PHASE1_FIELDS) console.log(`  ${f.padEnd(18)} ${changed[f].toLocaleString()}`);
  console.log(`\nOwner resolution: set ${changed.ownerId.toLocaleString()} | name present but unresolved ${ownerUnresolved.toLocaleString()} | no owner name ${ownerNoName.toLocaleString()}`);
  console.log(`\nSample diffs:`);
  samples.forEach((s) => console.log(s));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
