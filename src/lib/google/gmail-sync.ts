// src/lib/google/gmail-sync.ts
/**
 * Gmail sync orchestration. Pure of DB/Google specifics: it takes an injected
 * GmailClient and a SyncDeps bag (match/exists/create/thread), so it is fully
 * unit-testable. The cron route wires the real prisma + client.
 */
import { parseHeaders, detectDirection, pickCounterparty, extractPlainBody, extractHtmlBody } from "./gmail-map";
import { normalizeSubject, normalizeMessageId } from "@/lib/email/threading";
import type { GmailClient } from "./gmail-client";

export interface MatchResult { leadId: string | null; contactId: string | null; accountId: string | null; ownerId: string | null }

export interface SyncDeps {
  matchByEmail(email: string): Promise<MatchResult | null>;
  existsByGmailId(gmailId: string): Promise<boolean>;
  existsByMessageIdHeader(header: string): Promise<boolean>;
  createMessage(data: Record<string, unknown>): Promise<void>;
  /** Refresh the stored body of an already-synced message (used on full backfill). */
  updateBodyByGmailId(gmailId: string, body: { bodyText: string | null; bodyHtml: string | null }): Promise<void>;
  resolveThread(counterparty: string, subject: string, inReplyTo: string | null): Promise<string | null>;
}

export interface MailboxRef { repEmail: string; repUserId: string; historyId: string | null }
export interface SyncResult { stored: number; scanned: number; newHistoryId: string | null; reseeded: boolean }

// Capture the whole mailbox (minus Google Chat), not just recent client mail.
// One list page; Gmail caps maxResults at 500. Deeper history would need paging.
const BACKFILL_QUERY = "-in:chats";
const BACKFILL_MAX = 500;

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
  // Backfill (no history cursor) also refreshes bodies of already-stored rows,
  // so older messages that were saved before HTML capture get their bodyHtml
  // backfilled. Incremental runs keep skipping already-synced messages.
  const isBackfill = !mb.historyId;
  for (const id of messageIds) {
    try {
      const alreadyStored = await deps.existsByGmailId(id);
      if (alreadyStored && !isBackfill) continue;
      const m = await client.getMessage(id);
      const bodyText = extractPlainBody(m.payload) || null;
      const bodyHtml = extractHtmlBody(m.payload) || null;
      if (alreadyStored) {
        await deps.updateBodyByGmailId(id, { bodyText, bodyHtml });
        continue;
      }
      const h = parseHeaders(m.headers);
      const direction = detectDirection(mb.repEmail, h.from);
      const counterparty = pickCounterparty(direction, h.from, h.to);
      if (!counterparty) continue;
      // Store every message; link it to a CRM record when the counterparty
      // matches a lead/contact/account, otherwise store it unlinked.
      const match = await deps.matchByEmail(counterparty);

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
        bodyText,
        bodyHtml,
        messageIdHeader: msgHeader,
        inReplyTo: h.inReplyTo ? normalizeMessageId(h.inReplyTo) : null,
        leadId: match?.leadId ?? null,
        contactId: match?.contactId ?? null,
        accountId: match?.accountId ?? null,
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
