import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { gmailConfigured, makeGmailClient } from "@/lib/google/gmail-client";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

function makeDeps(): SyncDeps {
  return {
    async matchByEmail(email) {
      const [lead, contact, account] = await Promise.all([
        prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
        prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
        prisma.account.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
      ]);
      if (!lead && !contact && !account) return null;
      return { leadId: lead?.id ?? null, contactId: contact?.id ?? null, accountId: account?.id ?? null, ownerId: null };
    },
    async existsByGmailId(id) { return Boolean(await prisma.emailMessage.findUnique({ where: { gmailMessageId: id }, select: { id: true } })); },
    async existsByMessageIdHeader(h) { return Boolean(await prisma.emailMessage.findFirst({ where: { messageIdHeader: h }, select: { id: true } })); },
    async createMessage(data) {
      const created = await prisma.emailMessage.create({ data: data as never, select: { id: true, threadId: true } });
      if (!created.threadId) await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
    },
    async resolveThread(counterparty, subject, inReplyTo) {
      return resolveThreadId({ inReplyTo, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders());
    },
  };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { userId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });
  if (body.enabled) {
    await prisma.gmailSync.upsert({
      where: { userId },
      update: { status: "ACTIVE", emailAddress: user.email.toLowerCase() },
      create: { userId, emailAddress: user.email.toLowerCase(), status: "ACTIVE" },
    });
  } else {
    await prisma.gmailSync.updateMany({ where: { userId }, data: { status: "PAUSED" } });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!gmailConfigured()) return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  const { userId } = await ctx.params;
  // { full: true } forces a full-mailbox backfill by ignoring the saved history
  // cursor for this run (dedup keeps it idempotent); default is incremental.
  const body = (await req.json().catch(() => ({}))) as { full?: boolean };
  const row = await prisma.gmailSync.findUnique({ where: { userId } });
  if (!row || row.status === "PAUSED") return NextResponse.json({ error: "Not enabled" }, { status: 400 });
  try {
    const client = makeGmailClient(row.emailAddress);
    const res = await syncOneMailbox({ repEmail: row.emailAddress, repUserId: userId, historyId: body.full ? null : row.historyId }, client, makeDeps());
    await prisma.gmailSync.update({ where: { userId }, data: { historyId: res.newHistoryId, lastSyncedAt: new Date(), lastError: null, status: "ACTIVE", syncedCount: { increment: res.stored } } });
    return NextResponse.json({ ok: true, stored: res.stored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    await prisma.gmailSync.update({ where: { userId }, data: { status: "ERROR", lastError: msg.slice(0, 500) } }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
