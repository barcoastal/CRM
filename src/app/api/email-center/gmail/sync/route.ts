// src/app/api/email-center/gmail/sync/route.ts
/**
 * POST /api/email-center/gmail/sync
 * Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 *
 * Loops ACTIVE GmailSync rows, syncs each mailbox, upserts matched mail as
 * EmailMessage (provider GMAIL). Add to the mini cron. Optional body { userId }
 * syncs just one mailbox (used by the admin "Sync now" button via internal call).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gmailConfigured, makeGmailClient } from "@/lib/google/gmail-client";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";

function authorize(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const primary = process.env.FLOW_POLL_SECRET;
  const fallback = process.env.PROCESSOR_SYNC_SECRET;
  if (!primary && !fallback) return false;
  return (!!primary && token === primary) || (!!fallback && token === fallback);
}

function makeDeps(): SyncDeps {
  return {
    async matchByEmail(email) {
      const [lead, contact, account] = await Promise.all([
        prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
        prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
        prisma.account.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
      ]);
      if (!lead && !contact && !account) return null;
      return { leadId: lead?.id ?? null, contactId: contact?.id ?? null, accountId: account?.id ?? null, ownerId: null };
    },
    async existsByGmailId(id) {
      return Boolean(await prisma.emailMessage.findUnique({ where: { gmailMessageId: id }, select: { id: true } }));
    },
    async existsByMessageIdHeader(header) {
      return Boolean(await prisma.emailMessage.findFirst({ where: { messageIdHeader: header }, select: { id: true } }));
    },
    async createMessage(data) {
      const created = await prisma.emailMessage.create({ data: data as never, select: { id: true, threadId: true } });
      if (!created.threadId) {
        await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
      }
    },
    async resolveThread(counterparty, subject, inReplyTo) {
      return resolveThreadId({ inReplyTo, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders());
    },
  };
}

async function runSync(where: { userId?: string }) {
  const rows = await prisma.gmailSync.findMany({
    where: { status: "ACTIVE", ...(where.userId ? { userId: where.userId } : {}) },
    take: 200,
  });
  const deps = makeDeps();
  const results: Array<{ userId: string; stored?: number; error?: string }> = [];
  for (const row of rows) {
    try {
      const client = makeGmailClient(row.emailAddress);
      const r = await syncOneMailbox({ repEmail: row.emailAddress, repUserId: row.userId, historyId: row.historyId }, client, deps);
      await prisma.gmailSync.update({
        where: { userId: row.userId },
        data: { historyId: r.newHistoryId, lastSyncedAt: new Date(), lastError: null, status: "ACTIVE", syncedCount: { increment: r.stored } },
      });
      results.push({ userId: row.userId, stored: r.stored });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync failed";
      await prisma.gmailSync.update({ where: { userId: row.userId }, data: { status: "ERROR", lastError: msg.slice(0, 500) } }).catch(() => undefined);
      results.push({ userId: row.userId, error: msg });
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gmailConfigured()) return NextResponse.json({ ok: false, skipped: "GOOGLE_SA not configured" });
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const results = await runSync({ userId: body.userId });
  return NextResponse.json({ ok: true, mailboxes: results.length, results });
}
