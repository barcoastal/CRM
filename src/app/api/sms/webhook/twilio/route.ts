/**
 * Twilio Messaging webhook — handles BOTH status callbacks (delivery
 * updates) and inbound SMS in one endpoint.
 *
 * Configure in Twilio:
 *   - Status Callback URL on outbound messages → set TWILIO_STATUS_CALLBACK_URL
 *     env to https://crm-production-613a.up.railway.app/api/sms/webhook/twilio
 *   - Inbound Messaging webhook (Phone Numbers → A Message Comes In) →
 *     same URL.
 *
 * Twilio posts application/x-www-form-urlencoded. Signature header:
 *   X-Twilio-Signature: <base64 hmac sha1>
 *
 * Status callback fields: MessageSid, MessageStatus (sent/delivered/failed/...)
 * Inbound fields: MessageSid, From, To, Body, NumSegments, ...
 *
 * Distinguish by presence of "Body" → treat as inbound.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // dev mode
  if (!signature) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

const STATUS_MAP: Record<string, string> = {
  queued: "QUEUED",
  accepted: "QUEUED",
  sending: "SENT",
  sent: "SENT",
  delivered: "DELIVERED",
  undelivered: "FAILED",
  failed: "FAILED",
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw).entries());

  const signature = request.headers.get("x-twilio-signature");
  // Construct the exact URL Twilio used (incl. proxy). Twilio docs say to
  // use the full callback URL including query string.
  const url = `${process.env.TWILIO_STATUS_CALLBACK_URL ?? new URL(request.url).toString()}`;
  if (!verifyTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Distinguish inbound vs status callback
  if (typeof params.Body === "string" && params.From && params.To) {
    // INBOUND SMS — create a new SmsMessage with direction=INBOUND
    await prisma.smsMessage.create({
      data: {
        direction: "INBOUND",
        status: "RECEIVED",
        fromNumber: params.From,
        toNumber: params.To,
        body: params.Body,
        segments: Number(params.NumSegments ?? "1"),
        providerMessageId: params.MessageSid ?? null,
        provider: "TWILIO",
      },
    });
    // Reply with empty TwiML so Twilio doesn't auto-reply
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // STATUS CALLBACK — update by providerMessageId
  const messageSid = params.MessageSid;
  const messageStatus = (params.MessageStatus ?? "").toLowerCase();
  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: false, skipped: "missing-fields" });
  }
  const newStatus = STATUS_MAP[messageStatus] ?? null;
  if (!newStatus) return NextResponse.json({ ok: true, ignored: messageStatus });

  const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, FAILED: 5 };
  const existing = await prisma.smsMessage.findFirst({
    where: { providerMessageId: messageSid },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ ok: true, skipped: "not-found" });
  if (RANK[newStatus] < RANK[existing.status]) {
    return NextResponse.json({ ok: true, skipped: "lower-rank" });
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "SENT" && !params.dateSent) update.sentAt = new Date();
  if (newStatus === "DELIVERED") update.deliveredAt = new Date();
  if (newStatus === "FAILED") {
    update.errorReason = params.ErrorMessage ?? "Twilio failure";
    update.errorCode = params.ErrorCode ?? null;
  }

  await prisma.smsMessage.update({ where: { id: existing.id }, data: update });
  return NextResponse.json({ ok: true });
}
