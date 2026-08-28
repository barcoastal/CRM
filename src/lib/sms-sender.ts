/**
 * Outbound SMS sender via SMS Magic (Conversive).
 * SMS Magic was the SF integration ("smagicinteract" package).
 *
 * Docs: https://docs.sms-magic.com/docs/single-message-api
 *
 * Env:
 *   SMS_MAGIC_API_KEY=<api key from SMS Magic portal>
 *   SMS_MAGIC_SENDER_ID=<short code / long code / alphanumeric sender>
 *   SMS_MAGIC_BASE_URL=https://api.sms-magic.com    (optional override)
 *   SMS_MAGIC_CALLBACK_URL=https://crm.coastaldebt-tools.com/api/sms/webhook/sms-magic
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

async function sendViaSmsMagic(args: {
  from?: string;
  to: string;
  body: string;
}): Promise<SendResult> {
  const apiKey = process.env.SMS_MAGIC_API_KEY;
  const senderId = args.from || process.env.SMS_MAGIC_SENDER_ID;
  const base = process.env.SMS_MAGIC_BASE_URL ?? "https://api.sms-magic.com";

  if (!apiKey) return { ok: false, error: "SMS_MAGIC_API_KEY not set" };
  if (!senderId) return { ok: false, error: "SMS_MAGIC_SENDER_ID not set (and no fromNumber on row)" };

  // Real single-message API (https://api.sms-magic.com/doc/):
  //   POST /v1/sms/send   header apikey   body {sms_text, sender_id, mobile_number}
  //   200 -> { status: "submitted", message: "queued", id: "<uuid>" }
  //   401 -> { message: "REQ-API-KEY" }
  // There is no external_id param; we correlate delivery reports by the returned
  // id (stored as providerMessageId). Delivery/inbound are pushed to the URL
  // registered in the SMS Magic portal, not passed per request.
  const body = {
    sms_text: args.body,
    sender_id: senderId,
    mobile_number: toE164(args.to),
  };

  try {
    const res = await fetch(`${base}/v1/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      message?: string;
    };
    if (!res.ok || !data.id || (data.status && data.status !== "submitted")) {
      return {
        ok: false,
        error: data.message ?? data.status ?? `HTTP ${res.status}`,
        errorCode: res.status === 401 ? "AUTH" : undefined,
      };
    }
    return { ok: true, providerMessageId: data.id };
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

/** Send a single queued SMS via SMS Magic. Updates the row in place. */
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

  const result = await sendViaSmsMagic({
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
          provider: "SMS_MAGIC",
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

/** Verify the SMS Magic API key + fetch the remaining credit balance. Used by
 *  the settings "test connection" action. */
export async function checkSmsMagic(): Promise<{ ok: boolean; smsCredits?: string; mmsCredits?: string; error?: string }> {
  const apiKey = process.env.SMS_MAGIC_API_KEY;
  const base = process.env.SMS_MAGIC_BASE_URL ?? "https://api.sms-magic.com";
  if (!apiKey) return { ok: false, error: "SMS_MAGIC_API_KEY not set" };
  try {
    const v = await fetch(`${base}/v1/api_key/validate`, { headers: { apikey: apiKey } });
    if (!v.ok) return { ok: false, error: v.status === 401 ? "Invalid API key" : `Validate HTTP ${v.status}` };
    const c = await fetch(`${base}/api/v2/unified/getCredits`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }),
    });
    const cd = (await c.json().catch(() => ({}))) as { responseText?: { sms_credits?: string; mms_credits?: string } };
    return { ok: true, smsCredits: cd.responseText?.sms_credits, mmsCredits: cd.responseText?.mms_credits };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "check failed" };
  }
}

/**
 * Send an ad-hoc outbound SMS immediately (not from the queue) and log it as an
 * SmsMessage. Used by programmatic senders like booking confirmations.
 */
export async function sendSmsNow(args: {
  to: string;
  body: string;
  from?: string | null;
  leadId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
}): Promise<SendResult & { smsId: string }> {
  const hasUnicode = /[^\x00-\x7F]/.test(args.body);
  const segments = Math.max(1, Math.ceil(args.body.length / (hasUnicode ? 70 : 160)));
  const row = await prisma.smsMessage.create({
    data: {
      direction: "OUTBOUND", status: "QUEUED", provider: "SMS_MAGIC",
      toNumber: args.to, fromNumber: args.from ?? process.env.SMS_MAGIC_SENDER_ID ?? "", body: args.body, segments,
      leadId: args.leadId ?? null, accountId: args.accountId ?? null, contactId: args.contactId ?? null,
      opportunityId: args.opportunityId ?? null,
    },
    select: { id: true },
  });
  const result = await sendQueuedSms(row.id);
  return { ...result, smsId: row.id };
}
