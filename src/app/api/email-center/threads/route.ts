/**
 * GET /api/email-center/threads?folder=inbox|sent|all&user=<userId|all>
 *
 * Returns the caller's conversations (grouped by threadId), newest activity
 * first. Admins (SUPER_ADMIN / ADMIN / MANAGER) may pass ?user= to view
 * another user's inbox or "all" for everyone's.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") ?? "inbox";
  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  const userParam = url.searchParams.get("user");

  let ownerFilter: { ownerId?: string } = { ownerId: r.session.userId };
  if (isAdmin && userParam === "all") ownerFilter = {};
  else if (isAdmin && userParam) ownerFilter = { ownerId: userParam };

  const directionFilter =
    folder === "inbox"
      ? { direction: "INBOUND" }
      : folder === "sent"
        ? { direction: "OUTBOUND" }
        : {};

  // Latest 500 messages in scope, grouped into threads in JS. threadId is
  // always set for new mail; legacy rows without one thread as themselves.
  const messages = await prisma.emailMessage.findMany({
    where: { ...ownerFilter, ...directionFilter },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      threadId: true,
      direction: true,
      status: true,
      fromAddress: true,
      toAddresses: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      readAt: true,
      sentAt: true,
      createdAt: true,
      leadId: true,
      accountId: true,
      contactId: true,
      owner: { select: { id: true, name: true } },
      lead: { select: { id: true, contactName: true } },
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
    },
  });

  const threads = new Map<string, {
    threadId: string;
    subject: string;
    lastAt: string;
    lastFrom: string;
    lastDirection: string;
    snippet: string;
    messageCount: number;
    unreadCount: number;
    ownerName: string | null;
    leadId: string | null;
    leadName: string | null;
    accountId: string | null;
    accountName: string | null;
    contactId: string | null;
    contactName: string | null;
  }>();

  for (const m of messages) {
    const key = m.threadId ?? m.id;
    const unread = m.direction === "INBOUND" && !m.readAt ? 1 : 0;
    const existing = threads.get(key);
    if (!existing) {
      const text = (m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, " ") ?? "").trim();
      threads.set(key, {
        threadId: key,
        subject: m.subject || "(no subject)",
        lastAt: (m.sentAt ?? m.createdAt).toISOString(),
        lastFrom: m.fromAddress,
        lastDirection: m.direction,
        snippet: text.slice(0, 120),
        messageCount: 1,
        unreadCount: unread,
        ownerName: m.owner?.name ?? null,
        leadId: m.leadId,
        leadName: m.lead?.contactName ?? null,
        accountId: m.accountId,
        accountName: m.account?.name ?? null,
        contactId: m.contactId,
        contactName: m.contact?.fullName ?? null,
      });
    } else {
      existing.messageCount += 1;
      existing.unreadCount += unread;
    }
  }

  return NextResponse.json({ threads: [...threads.values()] });
}
