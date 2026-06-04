/**
 * Outbound SMS sender via Twilio.
 * Mirrors src/lib/email-sender.ts.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM_NUMBER=+18005551234           (E.164; can be overridden per message)
 *   TWILIO_MESSAGING_SERVICE_SID=MG...        (optional; preferred over FROM_NUMBER if set — enables A2P 10DLC pool)
 *   TWILIO_STATUS_CALLBACK_URL=https://crm-production-613a.up.railway.app/api/sms/webhook/twilio
 *
 * The same {{token}} merge from email-sender is reused for SMS bodies.
 */

import { prisma } from "@/lib/prisma";
import { mergeTokens } from "@/lib/email-sender";
import type { SmsMessage } from "@/generated/prisma/client";

interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
}

/** Best-effort E.164 normalization: prepend +1 for 10-digit US numbers. */
export function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendViaTwilio(args: {
  from?: string;
  to: string;
  body: string;
}): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = args.from ?? process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;

  if (!sid || !token) return { ok: false, error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set" };
  if (!fromNumber && !messagingServiceSid) {
    return { ok: false, error: "Either TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID must be set" };
  }

  const form = new URLSearchParams();
  form.set("To", toE164(args.to));
  form.set("Body", args.body);
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else if (fromNumber) form.set("From", toE164(fromNumber));
  if (statusCallback) form.set("StatusCallback", statusCallback);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message ?? `HTTP ${res.status}`,
        errorCode: data.code ? String(data.code) : undefined,
      };
    }
    return { ok: true, providerMessageId: data.sid };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Build merge vars for an SMS — same pattern as email-sender.buildMergeVars. */
async function buildSmsVars(msg: SmsMessage): Promise<Record<string, string | number | null>> {
  const vars: Record<string, string | number | null> = {};
  if (msg.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: msg.leadId },
      include: { assignedTo: { select: { name: true } } },
    });
    if (lead) {
      vars.firstName = lead.contactName?.split(" ")[0] ?? "";
      vars.contactName = lead.contactName;
      vars.businessName = lead.businessName;
      vars.ownerName = lead.assignedTo?.name ?? "";
    }
  }
  if (msg.accountId) {
    const acct = await prisma.account.findUnique({
      where: { id: msg.accountId },
      include: { owner: { select: { name: true } } },
    });
    if (acct) {
      vars.accountName = acct.name;
      vars.escrowBalance = acct.escrowBalance;
      vars.ownerName = acct.owner?.name ?? vars.ownerName ?? "";
    }
  }
  if (msg.contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: msg.contactId } });
    if (contact) {
      vars.firstName = contact.firstName ?? vars.firstName ?? "";
      vars.contactName = contact.fullName;
    }
  }
  return vars;
}

/** Send a single queued SMS. Updates the row in place. */
export async function sendQueuedSms(msgId: string): Promise<SendResult> {
  const msg = await prisma.smsMessage.findUnique({ where: { id: msgId } });
  if (!msg) return { ok: false, error: "Not found" };
  if (msg.status === "SENT" || msg.status === "DELIVERED") {
    return { ok: true, providerMessageId: msg.providerMessageId ?? undefined };
  }
  if (msg.direction !== "OUTBOUND") return { ok: false, error: "Not outbound" };

  const vars = await buildSmsVars(msg);
  const body = mergeTokens(msg.body, vars);

  // Approximate segment count: 160 chars per GSM segment (or 70 chars per UCS-2 if non-ASCII).
  const hasUnicode = /[^\x00-\x7F]/.test(body);
  const segmentSize = hasUnicode ? 70 : 160;
  const segments = Math.max(1, Math.ceil(body.length / segmentSize));

  const result = await sendViaTwilio({
    from: msg.fromNumber || undefined,
    to: msg.toNumber,
    body,
  });

  await prisma.smsMessage.update({
    where: { id: msgId },
    data: result.ok
      ? {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          provider: "TWILIO",
          body,
          segments,
        }
      : {
          status: "FAILED",
          errorReason: result.error ?? "send failed",
          errorCode: result.errorCode ?? null,
        },
  });

  return result;
}

export async function drainSmsQueue(limit = 50): Promise<{ sent: number; failed: number }> {
  const queue = await prisma.smsMessage.findMany({
    where: { status: "QUEUED", direction: "OUTBOUND" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;
  for (const { id } of queue) {
    const r = await sendQueuedSms(id);
    if (r.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}
