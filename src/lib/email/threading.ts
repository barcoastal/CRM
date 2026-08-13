/**
 * Conversation threading for the Email Center inbox.
 *
 * Thread resolution order:
 *   1. RFC In-Reply-To header match against stored messageIdHeader.
 *   2. Fallback: same normalized subject + shared counterparty address within
 *      the last 30 days.
 *   3. No match: caller creates the message, then sets threadId = its own id.
 *
 * DB access is injected via ThreadFinders so the logic is unit-testable;
 * prismaThreadFinders() is the production implementation.
 */
import { prisma } from "@/lib/prisma";

const SUBJECT_PREFIX = /^(re|fw|fwd)\s*:\s*/i;

export function normalizeSubject(subject: string): string {
  let s = (subject ?? "").trim();
  while (SUBJECT_PREFIX.test(s)) s = s.replace(SUBJECT_PREFIX, "");
  return s.trim().toLowerCase();
}

/** Message-IDs appear both as "<abc@x>" and "abc@x" depending on provider; compare normalized. */
export function normalizeMessageId(id: string): string {
  return id.replace(/^</, "").replace(/>$/, "").trim().toLowerCase();
}

/** Parse "Name <a@b>, c@d" style strings into lowercase bare addresses. */
export function extractEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const segments: string[] = [];
  let buf = "";
  let inQuotes = false;
  let inAngle = false;
  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "<") inAngle = true;
    else if (ch === ">") inAngle = false;
    if (ch === "," && !inQuotes && !inAngle) {
      segments.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  segments.push(buf);
  return segments
    .map((part) => {
      const m = part.match(/<([^>]+)>/);
      return (m?.[1] ?? part).replace(/"/g, "").trim().toLowerCase();
    })
    .filter((e) => e.includes("@"));
}

export interface ThreadCandidate {
  inReplyTo?: string | null;
  subject: string;
  counterpartyEmails: string[];
}

export interface ThreadFinders {
  byMessageIdHeader(messageId: string): Promise<{ id: string; threadId: string | null } | null>;
  bySubjectAndCounterparty(
    subjectNorm: string,
    emails: string[],
    since: Date,
  ): Promise<{ id: string; threadId: string | null } | null>;
}

export async function resolveThreadId(
  c: ThreadCandidate,
  find: ThreadFinders,
  now: Date = new Date(),
): Promise<string | null> {
  if (c.inReplyTo) {
    const parent = await find.byMessageIdHeader(c.inReplyTo);
    if (parent) return parent.threadId ?? parent.id;
  }
  const subjectNorm = normalizeSubject(c.subject);
  if (!subjectNorm || c.counterpartyEmails.length === 0) return null;
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const match = await find.bySubjectAndCounterparty(subjectNorm, c.counterpartyEmails, since);
  if (match) return match.threadId ?? match.id;
  return null;
}

export function prismaThreadFinders(): ThreadFinders {
  return {
    // Matches only Message-ID/provider ids; outbound replies get threadId directly at compose time, so no reverse inReplyTo lookup is needed.
    async byMessageIdHeader(messageId) {
      const bare = normalizeMessageId(messageId);
      const bracketed = `<${bare}>`;
      return prisma.emailMessage.findFirst({
        where: {
          OR: [
            { messageIdHeader: { in: [bare, bracketed], mode: "insensitive" } },
            { providerMessageId: { in: [bare, bracketed], mode: "insensitive" } },
          ],
        },
        select: { id: true, threadId: true },
      });
    },
    async bySubjectAndCounterparty(subjectNorm, emails, since) {
      if (emails.length === 0) return null;
      const wanted = new Set(emails.map((e) => e.toLowerCase()));
      const candidates = await prisma.emailMessage.findMany({
        where: { subjectNorm, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, threadId: true, fromAddress: true, toAddresses: true },
      });
      for (const c of candidates) {
        const participants = [...extractEmails(c.fromAddress), ...extractEmails(c.toAddresses)];
        if (participants.some((p) => wanted.has(p))) {
          return { id: c.id, threadId: c.threadId };
        }
      }
      return null;
    },
  };
}
