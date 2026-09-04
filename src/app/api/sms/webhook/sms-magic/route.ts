/**
 * SMS Magic push webhook - handles both delivery reports AND inbound SMS.
 * Payloads match the real API (https://api.sms-magic.com/doc/), pushed from
 * IP 34.197.38.71 to the URL you register in the SMS Magic portal.
 *
 * Register this URL for BOTH:
 *   - Delivery reports  -> POST { id, delivery_status, timestamp, mobile_number, label }
 *   - Incoming messages -> POST { id, sent_from, sent_to, msg, timestamp }
 *
 * `id` on a delivery report is the message id we stored as providerMessageId
 * when we sent (there is no external_id in the send API).
 *
 * Auth: optionally require a shared secret via SMS_MAGIC_WEBHOOK_SECRET, sent
 * as `x-sms-magic-secret` or a bearer Authorization header. SMS Magic itself
 * does not sign requests, so also whitelist their IP at the edge if possible.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// delivery_status values seen: "success", "failed", "undelivered", "expired", "rejected"
const DELIVERY_MAP: Record<string, string> = {
  success: "DELIVERED",
  delivered: "DELIVERED",
  sent: "SENT",
  submitted: "SENT",
  queued: "QUEUED",
  failed: "FAILED",
  undelivered: "FAILED",
  expired: "FAILED",
  rejected: "FAILED",
};

const STATUS_RANK: Record<string, number> = { QUEUED: 0, RECEIVED: 0, SENT: 1, DELIVERED: 2, FAILED: 5 };

function checkAuth(headers: Headers): boolean {
  const required = process.env.SMS_MAGIC_WEBHOOK_SECRET;
  if (!required) return true;
  const got =
    headers.get("x-sms-magic-secret") ??
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return got === required;
}

/** Coerce any JSON scalar (SMS Magic sends phone numbers + ids as NUMBERS, not
 *  strings) to a trimmed string. null/undefined -> "". */
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function last10(raw: unknown): string {
  const digits = str(raw).replace(/[^0-9]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string | undefined>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // -------------------- Inbound SMS --------------------
  // { id, sent_from, sent_to, msg, timestamp }
  if (body.msg !== undefined && body.sent_from) {
    const from = body.sent_from ?? "";
    const to = body.sent_to ?? "";
    const text = body.msg ?? "";
    const messageId = body.id ?? null;

    const key = last10(from);
    const lead = key
      ? await prisma.lead.findFirst({
          where: { phone: { contains: key } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, convertedAccountId: true },
        })
      : null;

    await prisma.smsMessage.create({
      data: {
        direction: "INBOUND",
        status: "RECEIVED",
        fromNumber: from,
        toNumber: to,
        body: text,
        provider: "SMS_MAGIC",
        providerMessageId: messageId,
        leadId: lead?.id ?? null,
        accountId: lead?.convertedAccountId ?? null,
      },
    });

    // Port of SF SMSMagicTriggerHandler - bump lastContactedAt on the related record.
    const now = new Date();
    if (lead) {
      await prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: now } }).catch(() => undefined);
      if (lead.convertedAccountId) {
        await prisma.account.update({ where: { id: lead.convertedAccountId }, data: { updatedAt: now } }).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true, action: "inbound", leadId: lead?.id ?? null });
  }

  // -------------------- Delivery report --------------------
  // { id, delivery_status, timestamp, mobile_number, label }
  const messageId = body.id ?? null;
  const raw = (body.delivery_status ?? "").toLowerCase();
  // status can be "failed : INVALID-MOBILE-NUMBER"; take the leading word
  const statusWord = raw.split(/[:\s]/)[0];
  const newStatus = DELIVERY_MAP[statusWord] ?? null;
  if (!messageId || !newStatus) return NextResponse.json({ ok: true, ignored: raw || "no-id" });

  const existing = await prisma.smsMessage.findFirst({
    where: { providerMessageId: messageId },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ ok: true, skipped: "not-found" });
  if (STATUS_RANK[newStatus] < STATUS_RANK[existing.status]) {
    return NextResponse.json({ ok: true, skipped: "lower-rank" });
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "SENT") update.sentAt = new Date();
  if (newStatus === "DELIVERED") update.deliveredAt = new Date();
  if (newStatus === "FAILED") update.errorReason = raw || "SMS Magic delivery failure";

  await prisma.smsMessage.update({ where: { id: existing.id }, data: update });
  return NextResponse.json({ ok: true });
}
