/**
 * Salesforce Files sync - downloads every file linked to an Account or
 * Opportunity (ContentDocumentLink -> ContentVersion binary) into the app
 * volume and registers each as a Document, so the CRM Files lists match SF.
 *
 * - One binary per ContentDocument (deduped across links); a doc linked to
 *   both an account and an opportunity gets one Document row with both FKs.
 * - Resume-safe: existing Document rows (by sfId) with their file on disk are
 *   skipped, so the nightly run only pulls new files.
 * - Disk guard: stops when free space on the target volume drops under 2 GB.
 *
 * Usage: SF_AUTH_URL=force://... DATABASE_URL=... npx tsx scripts/sync-sf-files.ts [maxFiles]
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

const MAX_FILES = process.argv[2] ? Number(process.argv[2]) : Infinity;
const MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024; // stop at <2GB free
const CONCURRENCY = 8;

const FILES_DIR = process.env.NODE_ENV === "production" || fs.existsSync("/data")
  ? "/data/sf-files"
  : path.join(process.cwd(), ".data", "sf-files");

interface SfAuth { token: string; instanceUrl: string }

async function auth(): Promise<SfAuth> {
  const raw = process.env.SF_AUTH_URL;
  if (!raw) throw new Error("SF_AUTH_URL not set");
  const m = raw.match(/^force:\/\/([^:]*)::([^@]+)@(.+)$/);
  if (!m) throw new Error("SF_AUTH_URL malformed");
  const [, clientId, refreshToken, host] = m;
  const res = await fetch(`https://${host}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId || "PlatformCLI", refresh_token: refreshToken }),
  });
  const tok = (await res.json()) as { access_token?: string; instance_url?: string };
  if (!tok.access_token) throw new Error(`SF auth failed: ${JSON.stringify(tok).slice(0, 200)}`);
  return { token: tok.access_token, instanceUrl: tok.instance_url! };
}

interface LinkRow {
  ContentDocumentId: string;
  LinkedEntityId: string;
  ContentDocument: {
    Title: string;
    FileExtension: string | null;
    ContentSize: number;
    LatestPublishedVersionId: string;
  };
}

/** Paged REST query (Bulk API can't do the semi-join on ContentDocumentLink). */
async function* queryAll(a: SfAuth, soql: string): AsyncGenerator<LinkRow> {
  let url = `${a.instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${a.token}` } });
    const j = (await res.json()) as { records?: LinkRow[]; nextRecordsUrl?: string; done?: boolean };
    if (!j.records) throw new Error(`query failed: ${JSON.stringify(j).slice(0, 300)}`);
    for (const r of j.records) yield r;
    if (j.done || !j.nextRecordsUrl) return;
    url = `${a.instanceUrl}${j.nextRecordsUrl}`;
  }
}

function freeBytes(dir: string): number {
  const s = fs.statfsSync(dir);
  return s.bavail * s.bsize;
}

function safeName(title: string, ext: string | null, docId: string): string {
  const base = title.replace(/[^\w.\- ]+/g, "_").slice(0, 80).trim() || "file";
  const e = ext && /^[a-zA-Z0-9]{1,6}$/.test(ext) ? `.${ext.toLowerCase()}` : "";
  return `${docId}_${base}${e}`;
}

function docType(ext: string | null, title: string): string {
  const t = title.toLowerCase();
  if (t.includes("agreement") || t.includes("contract")) return "ENGAGEMENT_AGREEMENT";
  if (t.includes("statement") || t.includes("checking")) return "BANK_STATEMENT";
  if (t.includes("settlement") || t.includes("offer")) return "SETTLEMENT_OFFER";
  if (ext === "snote") return "NOTE";
  return "OTHER";
}

async function main() {
  const a = await auth();
  fs.mkdirSync(FILES_DIR, { recursive: true });

  // System user for the required uploadedById.
  const sysUser = await prisma.user.findFirst({
    where: { OR: [{ email: "bar@coastaldebt.com" }, { role: "SUPER_ADMIN" }] },
    select: { id: true },
  });
  if (!sysUser) throw new Error("No system user found for uploadedById");

  const accountMap = new Map<string, string>();
  for (const r of await prisma.account.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } })) {
    if (r.sfId) accountMap.set(r.sfId, r.id);
  }
  const oppMap = new Map<string, string>();
  for (const r of await prisma.opportunity.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } })) {
    if (r.sfId) oppMap.set(r.sfId, r.id);
  }
  const existing = new Set<string>();
  for (const r of await prisma.document.findMany({ where: { sfId: { not: null } }, select: { sfId: true } })) {
    if (r.sfId) existing.add(r.sfId);
  }
  console.log(`[${new Date().toISOString()}] ${accountMap.size} accounts, ${oppMap.size} opps mapped; ${existing.size} files already synced; dir=${FILES_DIR}`);

  // Collect links grouped by ContentDocumentId (a doc can link to both).
  interface Pending {
    docId: string; versionId: string; title: string; ext: string | null; size: number;
    accountId?: string; opportunityId?: string;
  }
  const docs = new Map<string, Pending>();
  const SELECT = "SELECT ContentDocumentId, LinkedEntityId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.ContentSize, ContentDocument.LatestPublishedVersionId FROM ContentDocumentLink";
  for (const [scope, map, key] of [
    ["Account", accountMap, "accountId"],
    ["Opportunity", oppMap, "opportunityId"],
  ] as const) {
    let n = 0;
    for await (const link of queryAll(a, `${SELECT} WHERE LinkedEntityId IN (SELECT Id FROM ${scope})`)) {
      n++;
      const crmId = map.get(link.LinkedEntityId);
      if (!crmId || !link.ContentDocument) continue;
      const d = docs.get(link.ContentDocumentId) ?? {
        docId: link.ContentDocumentId,
        versionId: link.ContentDocument.LatestPublishedVersionId,
        title: link.ContentDocument.Title,
        ext: link.ContentDocument.FileExtension,
        size: link.ContentDocument.ContentSize,
      };
      (d as Record<string, unknown>)[key] = (d as Record<string, unknown>)[key] ?? crmId;
      docs.set(link.ContentDocumentId, d);
    }
    console.log(`[${new Date().toISOString()}] ${scope}: ${n} links scanned`);
  }

  const todo = [...docs.values()].filter((d) => !existing.has(d.docId)).slice(0, MAX_FILES);
  console.log(`[${new Date().toISOString()}] ${docs.size} distinct files, ${todo.length} to download`);

  let done = 0;
  let failed = 0;
  let bytes = 0;
  let diskStop = false;

  async function worker(items: Pending[]) {
    for (const d of items) {
      if (diskStop) return;
      if (freeBytes(FILES_DIR) < MIN_FREE_BYTES) {
        diskStop = true;
        console.error(`[${new Date().toISOString()}] DISK GUARD: <2GB free - stopping downloads (resume-safe)`);
        return;
      }
      try {
        const res = await fetch(`${a.instanceUrl}/services/data/v62.0/sobjects/ContentVersion/${d.versionId}/VersionData`, {
          headers: { Authorization: `Bearer ${a.token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const fileName = safeName(d.title, d.ext, d.docId);
        const filePath = path.join(FILES_DIR, fileName);
        fs.writeFileSync(filePath, buf);
        await prisma.document.upsert({
          where: { sfId: d.docId },
          update: { accountId: d.accountId ?? null, opportunityId: d.opportunityId ?? null },
          create: {
            sfId: d.docId,
            name: d.title + (d.ext ? `.${d.ext}` : ""),
            type: docType(d.ext, d.title),
            filePath,
            fileSize: buf.length,
            accountId: d.accountId ?? null,
            opportunityId: d.opportunityId ?? null,
            uploadedById: sysUser!.id,
          },
        });
        done++;
        bytes += buf.length;
        if (done % 500 === 0) {
          console.log(`[${new Date().toISOString()}] ${done}/${todo.length} downloaded (${(bytes / 1024 / 1024).toFixed(0)} MB, ${failed} failed)`);
        }
      } catch (e) {
        failed++;
        if (failed <= 5 || failed % 100 === 0) {
          console.error(`[${new Date().toISOString()}] download failed for ${d.docId} (${d.title}): ${(e as Error).message}`);
        }
      }
    }
  }

  // Shard across workers.
  const shards: Pending[][] = Array.from({ length: CONCURRENCY }, () => []);
  todo.forEach((d, i) => shards[i % CONCURRENCY].push(d));
  await Promise.all(shards.map(worker));

  console.log(`[${new Date().toISOString()}] DONE Files: ${done} downloaded (${(bytes / 1024 / 1024).toFixed(0)} MB), ${failed} failed${diskStop ? ", STOPPED BY DISK GUARD" : ""}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
