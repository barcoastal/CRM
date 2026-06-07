/**
 * Inbound email webhook. Resend / SendGrid / Mailgun / Cloudflare Email Workers
 * forward parsed messages here; we save them as INBOUND EmailMessage rows and
 * try to attach them to a matching Lead / Contact / Account / Opportunity by
 * the sender's email address so the conversation surfaces on the record's
 * activity tab.
 *
 * Resend Inbound config:
 *   1. Verify your inbound domain in Resend.
 *   2. Create a route: catch-all -> https://crm-production-613a.up.railway.app/api/emails/webhook/inbound
 *   3. Set RESEND_WEBHOOK_SECRET env to the signing secret.
 *
 * Expected payload (Resend Inbound shape, also accepts a plain Mailgun-style
 * body for portability):
 *   {
 *     "from":    "Joseph Sullivan <joseph@example.com>",
 *     "to":      ["agent@coastaldebt.com"],
 *     "cc":      [],
 *     "subject": "Re: your settlement offer",
 *     "html":    "<p>Yes I accept ...</p>",
 *     "text":    "Yes I accept ...",
 *     "messageId": "abc123@example.com",
 *     "inReplyTo": "def456@coastaldebt.com",
 *     "receivedAt": "2026-06-07T15:00:00Z"
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

function verifySvix(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sig = headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  const signed = `${id}.${ts}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signed).digest("base64");
  return sig.split(" ").some((part) => part.replace(/^v\d+,/, "") === expected);
}

function extractEmail(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return (m?.[1] ?? s).trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySvix(rawBody, req.headers)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  // Resend Inbound wraps in { data: { ... } }; also accept top-level fields.
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const fromRaw = String(data.from ?? "");
  const fromEmail = extractEmail(fromRaw);
  const toArr = Array.isArray(data.to) ? (data.to as string[]) : [String(data.to ?? "")];
  const ccArr = Array.isArray(data.cc) ? (data.cc as string[]) : [];
  const subject = String(data.subject ?? "");
  const html = (data.html as string) ?? null;
  const text = (data.text as string) ?? null;
  const messageId = String(data.messageId ?? data.message_id ?? "");
  const inReplyTo = String(data.inReplyTo ?? data.in_reply_to ?? "");
  const receivedAt = data.receivedAt ? new Date(String(data.receivedAt)) : new Date();

  if (!fromEmail) return NextResponse.json({ error: "no from" }, { status: 400 });

  // Try to match by sender email -> Lead / Contact / Account / Opportunity
  const [lead, contact, account, opp] = await Promise.all([
    prisma.lead.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
    prisma.contact.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
    prisma.account.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
    prisma.opportunity.findFirst({ where: { oppEmail: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
  ]);

  // Owner = the related entity's owner if available, else first ADMIN-role user
  let ownerId: string | null =
    lead?.assignedToId ?? contact?.ownerId ?? account?.ownerId ?? opp?.assignedToId ?? null;
  if (!ownerId) {
    const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "MANAGER"] } }, select: { id: true } });
    ownerId = admin?.id ?? null;
  }
  // Last resort: any user
  if (!ownerId) {
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    ownerId = anyUser?.id ?? null;
  }
  if (!ownerId) return NextResponse.json({ error: "no owner candidate" }, { status: 500 });

  // De-dup by providerMessageId
  if (messageId) {
    const existing = await prisma.emailMessage.findFirst({
      where: { providerMessageId: messageId },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, dedup: true });
  }
  void inReplyTo; // schema doesn't carry a thread parent yet
  void receivedAt; // EmailMessage uses createdAt as the received timestamp

  const created = await prisma.emailMessage.create({
    data: {
      direction: "INBOUND",
      status: "DELIVERED",
      fromAddress: fromRaw,
      toAddresses: toArr.join(", "),
      cc: ccArr.length ? ccArr.join(", ") : null,
      subject,
      bodyHtml: html,
      bodyText: text,
      providerMessageId: messageId || null,
      provider: "RESEND_INBOUND",
      leadId: lead?.id ?? null,
      contactId: contact?.id ?? null,
      accountId: account?.id ?? null,
      opportunityId: opp?.id ?? null,
      ownerId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id, matched: { lead: !!lead, contact: !!contact, account: !!account, opportunity: !!opp } });
}
