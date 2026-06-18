/**
 * Recreate Salesforce Account list views (including personal/rep lists) in the
 * CRM's ListView model. IDEMPOTENT (upsert on [entity, developerName]).
 *
 *   DATABASE_URL=... npx tsx prisma/seed-account-listviews.ts
 *
 * Source: docs/sf-export/account-listviews.json (extracted 2026-06-17).
 * Owner filters are resolved to ownerId IN [...] by matching User.name. Unmatched
 * reps and unmappable SF fields are reported at the end (never guessed).
 *
 * Field mapping lives in src/lib/sf-account-listview-map.ts (pure, dry-runnable).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  type RawList,
  type ListFilter,
  mapFilter,
  mapColumns,
  isOwnerFilter,
} from "../src/lib/sf-account-listview-map";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);
const warnings: string[] = [];

async function resolveOwnerIds(names: string[], listLabel: string): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const exact = await prisma.user.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (exact) { ids.push(exact.id); continue; }
    const loose = await prisma.user.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (loose) ids.push(loose.id);
    else warnings.push(`[${listLabel}] owner not found in CRM: "${name}"`);
  }
  return ids;
}

async function main() {
  const path = join(__dirname, "..", "docs", "sf-export", "account-listviews.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { lists: RawList[] };

  let created = 0, updated = 0, order = 100;

  for (const list of data.lists) {
    if (list.developerName === "All_Accounts") continue; // already a system view

    const filters: ListFilter[] = [];
    for (const rf of list.filters) {
      const m = mapFilter(rf, list.label, warnings);
      if (!m) continue;
      if (isOwnerFilter(m)) {
        const ids = await resolveOwnerIds(m.ownerNames, list.label);
        if (ids.length) filters.push({ field: "ownerId", op: "IN", value: ids });
        else warnings.push(`[${list.label}] owner filter matched no CRM users — skipped`);
      } else {
        filters.push(m);
      }
    }
    // SF custom logic: an account uses ONE payment processor, so "External SAS Id
    // is-set AND External RAM Id is-set" in SF means OR, not AND. Collapse the pair.
    const sasIdx = filters.findIndex((f) => f.field === "externalSasId" && f.op === "IS_NOT_NULL");
    const ramIdx = filters.findIndex((f) => f.field === "externalRamId" && f.op === "IS_NOT_NULL");
    if (sasIdx >= 0 && ramIdx >= 0) {
      const pair = [filters[sasIdx], filters[ramIdx]];
      const rest = filters.filter((_, i) => i !== sasIdx && i !== ramIdx);
      rest.push({ field: "OR", op: "OR", value: pair });
      filters.length = 0;
      filters.push(...rest);
    }

    const columns = mapColumns(list.columns, list.label, warnings);
    const developerName = `SF_${list.developerName}`;

    const existing = await prisma.listView.findUnique({
      where: { entity_developerName: { entity: "Account", developerName } },
    });
    const payload = {
      entity: "Account",
      name: list.label,
      developerName,
      filters: filters as object,
      columns: (columns.length ? columns : undefined) as object | undefined,
      sortField: "updatedAt",
      sortDir: "desc",
      isShared: true,
      isSystem: false,
      isPinned: false,
      sortOrder: order++,
    };

    if (existing) {
      await prisma.listView.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.listView.create({ data: payload });
      created++;
    }
  }

  console.log(`\nAccount list views seeded: ${created} created, ${updated} updated.`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
