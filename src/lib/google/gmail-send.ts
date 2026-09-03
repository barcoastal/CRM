// src/lib/google/gmail-send.ts
/**
 * Orchestrates a 1:1 Gmail send: build MIME -> send as the rep -> persist an
 * EmailMessage (provider GMAIL) + attachment rows. Pure of DB/Google specifics
 * via injected SendDeps, so it is unit-testable with mocks (same pattern as
 * gmail-sync.ts).
 */
import { buildMime } from "./mime-build";
import { normalizeSubject, normalizeMessageId } from "@/lib/email/threading";

export interface SendAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  storagePath?: string | null;
}

export interface SendRecord {
  leadId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  opportunityId?: string | null;
  caseId?: string | null;
}

export interface SendInput {
  repEmail: string;
  repUserId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string | null; // full "<...>" from the source message
  references?: string | null;
  gmailThreadId?: string | null;
  attachments: SendAttachment[];
  record?: SendRecord;
}

export interface PersistAttachment {
  filename: string;
  contentType: string;
  byteSize: number;
  storagePath: string | null;
  gmailAttachmentId: string | null;
}

export interface SendDeps {
  send(rawBase64url: string, threadId?: string | null): Promise<{ id: string; threadId: string | null }>;
  resolveThread(counterparty: string, subject: string, inReplyTo: string | null): Promise<string | null>;
  generateMessageId(domain: string): string;
  persist(msg: Record<string, unknown>, attachments: PersistAttachment[]): Promise<{ id: string }>;
}

export async function sendGmail(input: SendInput, deps: SendDeps): Promise<{ messageId: string; gmailId: string }> {
  const domain = input.repEmail.split("@")[1] || "coastaldebt.com";
  const msgHeader = deps.generateMessageId(domain); // "<...@domain>"

  const raw = buildMime({
    from: input.repEmail,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
    messageId: msgHeader,
    inReplyTo: input.inReplyTo ?? null,
    references: input.references ?? null,
    attachments: input.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content })),
  });

  const sent = await deps.send(raw, input.gmailThreadId ?? null);

  const counterparty = input.to[0] ?? "";
  const threadId = await deps.resolveThread(
    counterparty,
    input.subject,
    input.inReplyTo ? normalizeMessageId(input.inReplyTo) : null,
  );

  const persisted = await deps.persist(
    {
      direction: "OUTBOUND",
      status: "SENT",
      provider: "GMAIL",
      fromAddress: input.repEmail,
      toAddresses: input.to.join(","),
      cc: input.cc?.length ? input.cc.join(",") : null,
      bcc: input.bcc?.length ? input.bcc.join(",") : null,
      subject: input.subject,
      subjectNorm: normalizeSubject(input.subject),
      bodyText: input.bodyText || null,
      bodyHtml: input.bodyHtml || null,
      messageIdHeader: normalizeMessageId(msgHeader),
      inReplyTo: input.inReplyTo ? normalizeMessageId(input.inReplyTo) : null,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      leadId: input.record?.leadId ?? null,
      contactId: input.record?.contactId ?? null,
      accountId: input.record?.accountId ?? null,
      opportunityId: input.record?.opportunityId ?? null,
      caseId: input.record?.caseId ?? null,
      ownerId: input.repUserId,
      sentAt: new Date(),
      threadId,
    },
    input.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      byteSize: a.content.byteLength,
      storagePath: a.storagePath ?? null,
      gmailAttachmentId: null,
    })),
  );

  return { messageId: persisted.id, gmailId: sent.id };
}
