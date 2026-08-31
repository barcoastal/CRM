// src/lib/google/gmail-sync.ts
/**
 * Gmail sync orchestration. Pure of DB/Google specifics: it takes an injected
 * GmailClient and a SyncDeps bag (match/exists/create/thread), so it is fully
 * unit-testable. The cron route wires the real prisma + client.
 */
import { parseHeaders, detectDirection, pickCounterparty, extractPlainBody } from "./gmail-map";
import { normalizeSubject, normalizeMessageId } from "@/lib/email/threading";
import type { GmailClient } from "./gmail-client";

export interface MatchResult { leadId: string | null; contactId: string | null; accountId: string | null; ownerId: string | null }

export interface SyncDeps {
  matchByEmail(email: string): Promise<MatchResult | null>;
  existsByGmailId(gmailId: string): Promise<boolean>;
  existsByMessageIdHeader(header: string): Promise<boolean>;
  createMessage(data: Record<string, unknown>): Promise<void>;
  resolveThread(counterparty: string, subject: string, inReplyTo: string | null): Promise<string | null>;
}

export interface MailboxRef { repEmail: string; repUserId: string; historyId: string | null }
export interface SyncResult { stored: number; scanned: number; newHistoryId: string | null; reseeded: boolean }

const BACKFILL_QUERY = "newer_than:30d";
const BACKFILL_MAX = 300;

export async function syncOneMailbox(mb: MailboxRef, client: GmailClient, deps: SyncDeps): Promise<SyncResult> {
  let messageIds: string[] = [];
  let newHistoryId: string | null = mb.historyId;
  let reseeded = false;

  if (!mb.historyId) {
    const r = await client.listRecent(BACKFILL_QUERY, BACKFILL_MAX);
    messageIds = r.messageIds;
    newHistoryId = r.historyId;
  } else {
    const r = await client.listHistory(mb.historyId);
    if ("expired" in r) {
      const seed = await client.listRecent(BACKFILL_QUERY, BACKFILL_MAX);
      messageIds = seed.messageIds;
      newHistoryId = seed.historyId;
      reseeded = true;
    } else {
      messageIds = r.messageIds;
      newHistoryId = r.historyId ?? mb.historyId;
    }
  }

  let stored = 0;
  for (const id of messageIds) {
    try {
      if (await deps.existsByGmailId(id)) continue;
      const m = await client.getMessage(id);
      const h = parseHeaders(m.headers);
      const direction = detectDirection(mb.repEmail, h.from);
      const counterparty = pickCounterparty(direction, h.from, h.to);
      if (!counterparty) continue;
      const match = await deps.matchByEmail(counterparty);
      if (!match) continue; // CRM-match-only

      const msgHeader = h.messageId ? normalizeMessageId(h.messageId) : null;
      if (msgHeader && (await deps.existsByMessageIdHeader(msgHeader))) continue; // collapse with CRM-sent copy

      const subject = h.subject || "(no subject)";
      const threadId = await deps.resolveThread(counterparty, subject, h.inReplyTo ? normalizeMessageId(h.inReplyTo) : null);

      await deps.createMessage({
        direction,
        status: direction === "OUTBOUND" ? "SENT" : "DELIVERED",
        provider: "GMAIL",
        gmailMessageId: id,
        fromAddress: h.from,
        toAddresses: h.to,
        cc: h.cc || null,
        subject,
        subjectNorm: normalizeSubject(subject),
        bodyText: extractPlainBody(m.payload) || null,
        messageIdHeader: msgHeader,
        inReplyTo: h.inReplyTo ? normalizeMessageId(h.inReplyTo) : null,
        leadId: match.leadId,
        contactId: match.contactId,
        accountId: match.accountId,
        ownerId: mb.repUserId,
        threadId, // null -> the caller self-anchors after create
      });
      stored += 1;
    } catch {
      // one bad message never aborts the mailbox
      continue;
    }
  }
  return { stored, scanned: messageIds.length, newHistoryId, reseeded };
}
