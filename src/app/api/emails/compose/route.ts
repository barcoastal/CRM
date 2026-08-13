/**
 * Create + send an email in one shot.
 *
 *   POST /api/emails/compose
 *     body: {
 *       to?, cc?, bcc?, subject?, bodyHtml?, bodyText?, templateId?,
 *       leadId?, opportunityId?, accountId?, contactId?, creditorId?, caseId?,
 *       replyToMessageId?,  // optional: ID of the parent EmailMessage being replied to
 *       sendNow?: boolean (default true)
 *     }
 *
 * If replyToMessageId is provided, to/subject/threadId/inReplyTo are derived from
 * the parent message. Replies are sent from the user's mailboxAddress so that
 * inbound responses route back to the Email Center inbox.
 *
 * If templateId is provided, subject/body get rendered with merge tokens
 * pulled from the related entities. If sendNow=false, the message stays
 * QUEUED and the cron picks it up.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQueuedEmail } from "@/lib/email-sender";
import { extractEmails, normalizeSubject } from "@/lib/email/threading";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    templateId?: string;
    leadId?: string;
    opportunityId?: string;
    accountId?: string;
    contactId?: string;
    creditorId?: string;
    caseId?: string;
    replyToMessageId?: string;
    sendNow?: boolean;
  };

  // Load parent message when composing a reply.
  let parent: {
    id: string;
    threadId: string | null;
    subject: string;
    fromAddress: string;
    messageIdHeader: string | null;
    leadId: string | null;
    contactId: string | null;
    accountId: string | null;
    opportunityId: string | null;
    caseId: string | null;
    direction: string;
    toAddresses: string;
  } | null = null;

  if (body.replyToMessageId) {
    parent = await prisma.emailMessage.findUnique({
      where: { id: body.replyToMessageId },
      select: {
        id: true,
        threadId: true,
        subject: true,
        fromAddress: true,
        messageIdHeader: true,
        leadId: true,
        contactId: true,
        accountId: true,
        opportunityId: true,
        caseId: true,
        direction: true,
        toAddresses: true,
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "replyToMessageId not found" }, { status: 404 });
    }
  }

  // Resolve to/subject with parent fallbacks.
  const to =
    body.to ??
    (parent
      ? extractEmails(
          parent.direction === "OUTBOUND" ? parent.toAddresses : parent.fromAddress,
        ).join(", ")
      : undefined);
  if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

  const subject =
    body.subject ??
    (parent
      ? parent.subject.match(/^re:/i)
        ? parent.subject
        : "Re: " + parent.subject
      : "");

  // Send from the user's dedicated mailbox address so that replies route back
  // to the Email Center inbox. Fall back to their plain email, then the env default.
  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, mailboxAddress: true },
  });
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const senderAddress = sender?.mailboxAddress ?? sender?.email;
  const safeName = (sender?.name ?? senderAddress ?? "").replace(/"/g, '\\"');
  const fromAddress = senderAddress ? `"${safeName}" <${senderAddress}>` : defaultFrom;

  // Thread stamping: inherit from parent or start a new thread.
  const threadId = parent ? (parent.threadId ?? parent.id) : null;
  const inReplyTo = parent?.messageIdHeader ?? null;

  const msg = await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND",
      status: "QUEUED",
      fromAddress,
      toAddresses: to,
      cc: body.cc ?? null,
      bcc: body.bcc ?? null,
      subject,
      subjectNorm: normalizeSubject(subject),
      bodyHtml: body.bodyHtml ?? null,
      bodyText: body.bodyText ?? null,
      templateId: body.templateId ?? null,
      leadId: body.leadId ?? parent?.leadId ?? null,
      opportunityId: body.opportunityId ?? parent?.opportunityId ?? null,
      accountId: body.accountId ?? parent?.accountId ?? null,
      contactId: body.contactId ?? parent?.contactId ?? null,
      caseId: body.caseId ?? parent?.caseId ?? null,
      threadId,
      inReplyTo,
      ownerId: session.user.id,
    },
    select: { id: true, threadId: true },
  });

  // If this is a fresh thread (no parent), anchor threadId to the message itself.
  if (!msg.threadId) {
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { threadId: msg.id },
    });
  }

  if (body.sendNow !== false) {
    const result = await sendQueuedEmail(msg.id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, id: msg.id, error: result.error ?? "send failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, id: msg.id, providerMessageId: result.providerMessageId });
  }
  return NextResponse.json({ ok: true, id: msg.id, queued: true });
}
