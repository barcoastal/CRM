/**
 * SMS Magic webhook — handles both delivery status callbacks AND inbound SMS.
 *
 * Configure in the SMS Magic portal:
 *   - Set Callback URL on your sender → /api/sms/webhook/sms-magic
 *   - Inbound webhook → same URL
 *
 * Auth: SMS Magic sends an `Authorization` header equal to your account's
 * API key OR a shared-secret header `x-sms-magic-secret`. Set
 * SMS_MAGIC_WEBHOOK_SECRET to require that header.
 *
 * Payload (status):
 *   { event: "delivery_status", message_id, status: "delivered|failed|sent|queued",
 *     external_id, to, from, error_message?, error_code? }
 *
 * Payload (inbound):
 *   { event: "inbound", message_id, from, to, text, received_at }
 *
 * On inbound: create direction=INBOUND SmsMessage AND port the SF
 * SMSMagicTriggerHandler logic — bump lastContactedAt on the related
 * Lead / Account / Opportunity.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_MAP: Record<string, string> = {
  queued: "QUEUED",
  sent: "SENT",
  delivered: "DELIVERED",
  failed: "FAILED",
  undelivered: "FAILED",
};

const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  FAILED: 5,
  RECEIVED: 0,
};

function checkAuth(headers: Headers): boolean {
  const required = process.env.SMS_MAGIC_WEBHOOK_SECRET;
  if (!required) return true;
  const got =
    headers.get("x-sms-magic-secret") ??
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return got === required;
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("1") && digits.length === 11) return digits.slice(1);
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

  const event = body.event ?? body.type ?? "";

  // -------------------- Inbound SMS --------------------
  if (event === "inbound" || (body.text && body.from && body.to)) {
    const from = body.from ?? "";
    const to = body.to ?? "";
    const text = body.text ?? "";
    const messageId = body.message_id ?? null;

    // Match inbound number against Lead.phone (10-digit key)
    const phoneKey = normalizePhone(from);
    const lead = phoneKey
      ? await prisma.lead.findFirst({
          where: { phone: { contains: phoneKey } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, convertedAccountId: true, convertedOpportunityId: true },
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

    // Port of SF SMSMagicTriggerHandler — bump lastContactedAt on the
    // related Lead and Account
    const now = new Date();
    if (lead) {
      await prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: now } }).catch(() => undefined);
      if (lead.convertedAccountId) {
        await prisma.account.update({
          where: { id: lead.convertedAccountId },
          data: { updatedAt: now },
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true, action: "inbound", leadId: lead?.id ?? null });
  }

  // -------------------- Status callback --------------------
  const messageId = body.message_id ?? null;
  const externalId = body.external_id ?? null;
  const incomingStatus = (body.status ?? "").toLowerCase();
  const newStatus = STATUS_MAP[incomingStatus] ?? null;
  if (!newStatus) return NextResponse.json({ ok: true, ignored: incomingStatus });

  // Prefer external_id (our SmsMessage.id) for lookup; fall back to providerMessageId
  const existing = externalId
    ? await prisma.smsMessage.findUnique({
        where: { id: externalId },
        select: { id: true, status: true },
      })
    : messageId
      ? await prisma.smsMessage.findFirst({
          where: { providerMessageId: messageId },
          select: { id: true, status: true },
        })
      : null;

  if (!existing) return NextResponse.json({ ok: true, skipped: "not-found" });
  if (STATUS_RANK[newStatus] < STATUS_RANK[existing.status]) {
    return NextResponse.json({ ok: true, skipped: "lower-rank" });
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "SENT") update.sentAt = new Date();
  if (newStatus === "DELIVERED") update.deliveredAt = new Date();
  if (newStatus === "FAILED") {
    update.errorReason = body.error_message ?? "SMS Magic delivery failure";
    update.errorCode = body.error_code ?? null;
  }
  if (!messageId && existing.id === externalId && body.message_id) {
    update.providerMessageId = body.message_id;
  }

  await prisma.smsMessage.update({ where: { id: existing.id }, data: update });
  return NextResponse.json({ ok: true });
}
