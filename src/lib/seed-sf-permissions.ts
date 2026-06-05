/**
 * Seeds PermissionSet + PermissionSetPermission rows from the static
 * SF permissions manifest baked at build time. The manifest was generated
 * by walking docs/sf-export/sfdx-raw/permissionsets/*.permissionset-meta.xml
 * and extracting objectPermissions + userPermissions where enabled=true.
 *
 * Run via POST /api/admin/seed-sf-permissions (Setup.Admin).
 */

import { prisma } from "@/lib/prisma";
import manifest from "./sf-permissions-manifest.json";

interface SeedResult {
  permsetsCreated: number;
  permsetsUpdated: number;
  permissionsAdded: number;
  skipped: string[];
}

interface PermSetEntry {
  name: string;
  label: string;
  keys: string[];
}

export async function seedSFPermissions(): Promise<SeedResult> {
  const result: SeedResult = {
    permsetsCreated: 0,
    permsetsUpdated: 0,
    permissionsAdded: 0,
    skipped: [],
  };

  for (const entry of manifest as PermSetEntry[]) {
    if (entry.keys.length === 0) {
      result.skipped.push(entry.name);
      // Still create the permset shell so users can be assigned to it
      await prisma.permissionSet.upsert({
        where: { name: entry.name },
        update: { label: entry.label },
        create: { name: entry.name, label: entry.label, isCustom: true },
      });
      continue;
    }

    const existing = await prisma.permissionSet.findUnique({ where: { name: entry.name } });
    let psId: string;
    if (existing) {
      await prisma.permissionSet.update({ where: { id: existing.id }, data: { label: entry.label } });
      psId = existing.id;
      result.permsetsUpdated++;
    } else {
      const created = await prisma.permissionSet.create({
        data: { name: entry.name, label: entry.label, isCustom: true },
        select: { id: true },
      });
      psId = created.id;
      result.permsetsCreated++;
    }

    for (const key of entry.keys) {
      await prisma.permissionSetPermission.upsert({
        where: { permissionSetId_key: { permissionSetId: psId, key } },
        update: {},
        create: { permissionSetId: psId, key },
      }).catch(() => undefined);
      result.permissionsAdded++;
    }
  }

  return result;
}
