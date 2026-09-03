// src/app/api/emails/gmail/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { gmailConfigured, makeGmailWriteClient } from "@/lib/google/gmail-client";
import { sendGmail, type SendDeps, type SendAttachment } from "@/lib/google/gmail-send";
import { generateMessageId } from "@/lib/email-sender";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";
import { readAttachment } from "@/lib/email/attachments-storage";

export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  storagePath: z.string(),
  filename: z.string(),
  contentType: z.string().default("application/octet-stream"),
  byteSize: z.number().int().nonnegative().optional(),
});

const bodySchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().default(""),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
  replyToMessageId: z.string().optional(), // our EmailMessage.id
  forwardMessageId: z.string().optional(), // our EmailMessage.id
});

const withBrackets = (id: string | null | undefined): string | null =>
  id ? (id.startsWith("<") ? id : `<${id}>`) : null;

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!gmailConfigured()) return NextResponse.json({ error: "Gmail not configured" }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: r.session.userId }, select: { email: true } });
  if (!me?.email) return NextResponse.json({ error: "Your user has no email" }, { status: 400 });
  const repEmail = me.email.toLowerCase();

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Resolve reply/forward source for threading + record links + forwarded files.
  let inReplyTo: string | null = null;
  let references: string | null = null;
  let gmailThreadId: string | null = null;
  const record: Record<string, string | null> = {};
  const sourceId = d.replyToMessageId ?? d.forwardMessageId;
  const forwardedAttachments: SendAttachment[] = [];
  if (sourceId) {
    const src = await prisma.emailMessage.findUnique({
      where: { id: sourceId },
      include: { attachments: true, owner: { select: { email: true } } },
    });
    if (src) {
      record.leadId = src.leadId;
      record.contactId = src.contactId;
      record.accountId = src.accountId;
      record.opportunityId = src.opportunityId;
      record.caseId = src.caseId;
      if (d.replyToMessageId) {
        inReplyTo = withBrackets(src.messageIdHeader);
        references = withBrackets(src.messageIdHeader);
        gmailThreadId = src.gmailThreadId;
      }
      if (d.forwardMessageId) {
        const client = makeGmailWriteClient(repEmail);
        for (const a of src.attachments) {
          try {
            const content = a.storagePath
              ? await readAttachment(a.storagePath)
              : a.gmailAttachmentId && src.gmailMessageId
              ? await client.getAttachment(src.gmailMessageId, a.gmailAttachmentId)
              : null;
            if (content) forwardedAttachments.push({ filename: a.filename, contentType: a.contentType, content });
          } catch {
            // skip an unreadable original attachment rather than fail the forward
          }
        }
      }
    }
  }

  // Load uploaded files from disk into buffers for the MIME builder.
  const uploaded: SendAttachment[] = [];
  for (const a of d.attachments) {
    const content = await readAttachment(a.storagePath).catch(() => null);
    if (content) uploaded.push({ filename: a.filename, contentType: a.contentType, content, storagePath: a.storagePath });
  }

  const client = makeGmailWriteClient(repEmail);
  const deps: SendDeps = {
    send: (raw, threadId) => client.sendRaw(raw, threadId),
    resolveThread: (counterparty, subject, ir) =>
      resolveThreadId({ inReplyTo: ir, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders()),
    generateMessageId,
    persist: async (msg, atts) => {
      const created = await prisma.emailMessage.create({ data: msg as never, select: { id: true, threadId: true } });
      if (!created.threadId) await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
      if (atts.length) {
        await prisma.emailAttachment.createMany({ data: atts.map((a) => ({ ...a, messageId: created.id })) });
      }
      return { id: created.id };
    },
  };

  try {
    const result = await sendGmail(
      {
        repEmail,
        repUserId: r.session.userId,
        to: d.to,
        cc: d.cc,
        bcc: d.bcc,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: d.bodyHtml,
        inReplyTo,
        references,
        gmailThreadId,
        attachments: [...uploaded, ...forwardedAttachments],
        record,
      },
      deps,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail send failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
