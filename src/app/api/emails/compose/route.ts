/**
 * Create + send an email in one shot.
 *
 *   POST /api/emails/compose
 *     body: {
 *       to, cc?, bcc?, subject, bodyHtml?, bodyText?, templateId?,
 *       leadId?, opportunityId?, accountId?, contactId?, creditorId?, caseId?,
 *       sendNow?: boolean (default true)
 *     }
 *
 * If templateId is provided, subject/body get rendered with merge tokens
 * pulled from the related entities. If sendNow=false, the message stays
 * QUEUED and the cron picks it up.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQueuedEmail } from "@/lib/email-sender";

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
    sendNow?: boolean;
  };

  if (!body.to) return NextResponse.json({ error: "to required" }, { status: 400 });

  // Send "from" the logged-in user so replies route back to them. Resend
  // requires the domain to be verified — users at @coastaldebt.com become
  // legit senders once the domain is added in Resend.
  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const fromAddress = sender?.email
    ? `${sender.name ?? sender.email} <${sender.email}>`
    : defaultFrom;

  const msg = await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND",
      status: "QUEUED",
      fromAddress,
      toAddresses: body.to,
      cc: body.cc ?? null,
      bcc: body.bcc ?? null,
      subject: body.subject ?? "",
      bodyHtml: body.bodyHtml ?? null,
      bodyText: body.bodyText ?? null,
      templateId: body.templateId ?? null,
      leadId: body.leadId ?? null,
      opportunityId: body.opportunityId ?? null,
      accountId: body.accountId ?? null,
      contactId: body.contactId ?? null,
      caseId: body.caseId ?? null,
      ownerId: session.user.id,
    },
    select: { id: true },
  });

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
