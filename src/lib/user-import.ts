/**
 * Bulk-import users from a Salesforce CSV export.
 *
 * Accepted CSV columns (case-insensitive, flexible — uses what's there):
 *   Name | First Name | Last Name | Email | Username | Title | Profile |
 *   Role | Manager | Active | Permission Sets
 *
 * Mapping logic:
 *   - email comes from "Email" or "Username"
 *   - name = "Name" or "First Name" + " " + "Last Name"
 *   - profile maps to our Profile.name (created if not found, status=Active)
 *   - manager maps by email to existing User.id
 *   - active: true unless explicitly "false" / "0" / "inactive"
 *   - permissionSets: comma-separated list of names; we create + attach
 *
 * Default password for new users: "password123" (forces reset on first login
 * once we wire that flow — for now, every imported user logs in with this).
 */

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface ImportRow {
  email: string;
  name: string;
  title: string | null;
  profileName: string | null;
  roleName: string | null;
  managerEmail: string | null;
  active: boolean;
  permissionSetNames: string[];
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

function header(line: string): string[] {
  return parseLine(line).map((c) => c.trim().toLowerCase());
}

function parseLine(line: string): string[] {
  // Minimal CSV parser — handles quoted fields with commas
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else if (c === '"') {
      inQuotes = true;
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v) return v.trim();
  }
  return "";
}

function parseRow(headers: string[], cells: string[]): ImportRow | null {
  const row: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = cells[i] ?? "";
  }

  const email = pick(row, "email", "username", "user name").toLowerCase();
  if (!email) return null;

  const directName = pick(row, "name", "full name");
  const first = pick(row, "first name", "firstname", "first");
  const last = pick(row, "last name", "lastname", "last");
  const name = directName || `${first} ${last}`.trim();
  if (!name) return null;

  const activeRaw = pick(row, "active", "isactive", "is active", "status").toLowerCase();
  const active = activeRaw === "" || ["true", "1", "yes", "active"].includes(activeRaw);

  const permSets = pick(row, "permission sets", "permissionsets", "perm sets")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    email,
    name,
    title: pick(row, "title", "job title") || null,
    profileName: pick(row, "profile") || null,
    roleName: pick(row, "role", "user role") || null,
    managerEmail: (pick(row, "manager", "manager email") || "").toLowerCase() || null,
    active,
    permissionSetNames: permSets,
  };
}

export async function importUsersFromCSV(csv: string, options?: {
  defaultPassword?: string;
  skipInvitations?: boolean;
}): Promise<ImportResult> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { created: 0, updated: 0, skipped: 0, invalid: 0, errors: ["Empty CSV"] };
  }
  const headers = header(lines[0]);
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const parsed = parseRow(headers, cells);
    if (parsed) rows.push(parsed);
  }

  // Pre-create profiles + perm sets so we don't repeat work in the loop
  const profileNames = new Set(rows.map((r) => r.profileName).filter((n): n is string => !!n));
  for (const pn of profileNames) {
    await prisma.profile.upsert({
      where: { name: pn },
      update: {},
      create: { name: pn, label: pn, isActive: true },
    });
  }
  const permSetNames = new Set(rows.flatMap((r) => r.permissionSetNames));
  for (const psn of permSetNames) {
    await prisma.permissionSet.upsert({
      where: { name: psn },
      update: {},
      create: { name: psn, label: psn },
    }).catch(() => undefined);
  }

  const defaultHash = await bcrypt.hash(options?.defaultPassword ?? "password123", 10);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, invalid: 0, errors: [] };

  for (const row of rows) {
    try {
      const profile = row.profileName
        ? await prisma.profile.findUnique({ where: { name: row.profileName } })
        : null;

      const existing = await prisma.user.findUnique({ where: { email: row.email } });
      let userId: string;
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            isActive: row.active,
            profileId: profile?.id ?? existing.profileId,
          },
        });
        userId = existing.id;
        result.updated++;
      } else {
        const created = await prisma.user.create({
          data: {
            email: row.email,
            name: row.name,
            passwordHash: defaultHash,
            isActive: row.active,
            profileId: profile?.id ?? null,
          },
          select: { id: true },
        });
        userId = created.id;
        result.created++;
      }

      // Wire permission sets
      if (row.permissionSetNames.length > 0) {
        const sets = await prisma.permissionSet.findMany({
          where: { name: { in: row.permissionSetNames } },
          select: { id: true, name: true },
        });
        for (const s of sets) {
          await prisma.userPermissionSet.upsert({
            where: { userId_permissionSetId: { userId, permissionSetId: s.id } },
            update: {},
            create: { userId, permissionSetId: s.id },
          }).catch(() => undefined);
        }
      }
    } catch (e: unknown) {
      result.invalid++;
      result.errors.push(`${row.email}: ${e instanceof Error ? e.message : "fail"}`);
    }
  }

  // Second pass to wire managers (needs all users to exist first)
  for (const row of rows) {
    if (!row.managerEmail) continue;
    try {
      const manager = await prisma.user.findUnique({ where: { email: row.managerEmail }, select: { id: true } });
      if (!manager) continue;
      await prisma.user.update({
        where: { email: row.email },
        data: { managerId: manager.id },
      });
    } catch {
      // best-effort
    }
  }

  return result;
}
