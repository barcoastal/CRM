import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * War Room email feed: unlike /api/emails (which self-scopes non-admins), this
 * returns inbound email across ALL users, since the war room is a shared team
 * queue. GET with no params lists conversations (one per thread that has an
 * inbound message); GET ?threadId= returns that thread's messages.
 */
// The War Room email feed is scoped to this shared intake mailbox only (NOT
// individual reps' personal mail). Override with WAR_ROOM_MAILBOX if it moves.
const WAR_ROOM_MAILBOX = (process.env.WAR_ROOM_MAILBOX ?? "consultations@coastaldebt.com").toLowerCase();

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const threadId = new URL(req.url).searchParams.get("threadId");

  if (threadId) {
    const items = await prisma.emailMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true, direction: true, status: true, fromAddress: true, toAddresses: true,
        subject: true, bodyText: true, bodyHtml: true, createdAt: true, threadId: true,
      },
    });
    return NextResponse.json({ items: items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) });
  }

  // Scope to the intake mailbox: emails owned by that mailbox's user, or
  // addressed to it (covers both Gmail-synced rows and any inbound-webhook rows).
  const box = await prisma.user.findUnique({ where: { email: WAR_ROOM_MAILBOX }, select: { id: true } });

  // Recent inbound messages -> one conversation per thread (latest wins).
  const inbound = await prisma.emailMessage.findMany({
    where: {
      direction: "INBOUND",
      OR: [
        ...(box ? [{ ownerId: box.id }] : []),
        { toAddresses: { contains: WAR_ROOM_MAILBOX, mode: "insensitive" } },
        { cc: { contains: WAR_ROOM_MAILBOX, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      id: true, threadId: true, fromAddress: true, subject: true, bodyText: true, bodyHtml: true,
      createdAt: true, readAt: true,
      lead: { select: { id: true, contactName: true, businessName: true } },
      account: { select: { id: true, name: true } },
    },
  });

  const convos = new Map<string, {
    threadId: string; from: string; name: string | null; subject: string; snippet: string;
    lastAt: string; unread: number; leadId: string | null; accountId: string | null;
  }>();
  for (const m of inbound) {
    const key = m.threadId ?? m.id;
    const name = m.lead?.contactName ?? m.lead?.businessName ?? m.account?.name ?? null;
    const snippet = (m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, " ") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const existing = convos.get(key);
    if (!existing) {
      convos.set(key, {
        threadId: key, from: m.fromAddress, name, subject: m.subject,
        snippet, lastAt: m.createdAt.toISOString(),
        unread: m.readAt ? 0 : 1,
        leadId: m.lead?.id ?? null, accountId: m.account?.id ?? null,
      });
    } else if (!m.readAt) {
      existing.unread += 1;
    }
  }

  return NextResponse.json({ conversations: [...convos.values()] });
}
