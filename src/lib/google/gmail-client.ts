// src/lib/google/gmail-client.ts
/**
 * Gmail access via a service account with domain-wide delegation. The CRM
 * impersonates each rep (JWT subject = rep email) to read their mailbox with
 * gmail.readonly. The GmailClient interface is what gmail-sync depends on, so
 * tests can pass a mock instead of hitting Google.
 */
import { google } from "googleapis";

export interface GmailMessage {
  id: string;
  headers: Array<{ name?: string | null; value?: string | null }>;
  payload: unknown; // for body extraction
}

export interface GmailClient {
  /** Recent messages (initial backfill), returns ids + the mailbox's current historyId. */
  listRecent(query: string, max: number): Promise<{ messageIds: string[]; historyId: string | null }>;
  /** Incremental: message ids added since startHistoryId. `expired` when the cursor is too old. */
  listHistory(startHistoryId: string): Promise<{ messageIds: string[]; historyId: string | null } | { expired: true }>;
  getMessage(id: string): Promise<GmailMessage>;
}

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
}

/** Build a read-only Gmail client impersonating one rep. */
export function makeGmailClient(repEmail: string): GmailClient {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    subject: repEmail,
  });
  const gmail = google.gmail({ version: "v1", auth: jwt });

  return {
    async listRecent(query, max) {
      const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults: max });
      const messageIds = (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      const profile = await gmail.users.getProfile({ userId: "me" });
      return { messageIds, historyId: profile.data.historyId ?? null };
    },
    async listHistory(startHistoryId) {
      try {
        const ids = new Set<string>();
        let pageToken: string | undefined;
        let latestHistoryId: string | null = startHistoryId;
        do {
          const res = await gmail.users.history.list({
            userId: "me", startHistoryId, historyTypes: ["messageAdded"], pageToken, maxResults: 500,
          });
          for (const h of res.data.history ?? []) {
            for (const m of h.messagesAdded ?? []) if (m.message?.id) ids.add(m.message.id);
          }
          latestHistoryId = res.data.historyId ?? latestHistoryId;
          pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
        return { messageIds: [...ids], historyId: latestHistoryId };
      } catch (e: unknown) {
        // 404 = startHistoryId too old; caller re-seeds.
        if ((e as { code?: number }).code === 404) return { expired: true };
        throw e;
      }
    },
    async getMessage(id) {
      const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      return { id, headers: res.data.payload?.headers ?? [], payload: res.data.payload };
    },
  };
}

export interface GmailWriteClient {
  /** Send a base64url raw message; threadId groups it into an existing Gmail thread. */
  sendRaw(rawBase64url: string, threadId?: string | null): Promise<{ id: string; threadId: string | null }>;
  /** Add/remove Gmail label ids on a message (markRead = remove UNREAD, archive = remove INBOX). */
  modifyLabels(messageId: string, opts: { add?: string[]; remove?: string[] }): Promise<void>;
  /** Download one attachment's bytes. */
  getAttachment(messageId: string, attachmentId: string): Promise<Buffer>;
}

/** Build a read/write Gmail client (mail.google.com scope) impersonating one rep. */
export function makeGmailWriteClient(repEmail: string): GmailWriteClient {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://mail.google.com/"],
    subject: repEmail,
  });
  const gmail = google.gmail({ version: "v1", auth: jwt });

  return {
    async sendRaw(rawBase64url, threadId) {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: rawBase64url, threadId: threadId ?? undefined },
      });
      return { id: res.data.id ?? "", threadId: res.data.threadId ?? null };
    },
    async modifyLabels(messageId, opts) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds: opts.add, removeLabelIds: opts.remove },
      });
    },
    async getAttachment(messageId, attachmentId) {
      const res = await gmail.users.messages.attachments.get({ userId: "me", messageId, id: attachmentId });
      return Buffer.from(res.data.data ?? "", "base64url");
    },
  };
}
