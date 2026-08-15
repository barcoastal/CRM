/**
 * Resend webhook → update EmailMessage status.
 *
 * Configure in Resend dashboard:
 *   https://resend.com/webhooks → Add endpoint:
 *   https://crm.coastaldebt-tools.com/api/emails/webhook/resend
 *
 * Set RESEND_WEBHOOK_SECRET env to the signing secret Resend gives you.
 * Svix signature: header "svix-signature" = "v1,<base64hmac>".
 *
 * Events handled:
 *   email.sent       → no-op (already set on send)
 *   email.delivered  → status = DELIVERED, deliveredAt = now
 *   email.opened     → status = OPENED, openedAt = first time only
 *   email.clicked    → status = CLICKED, clickedAt = first time only
 *   email.bounced    → status = BOUNCED, errorReason = bounce reason
 *   email.complained → status = COMPLAINED
 *   email.failed     → status = FAILED, errorReason = failure reason
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { addEmailSuppression, decideSuppression } from "@/lib/email/suppression";

function verifySvixSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64");
  const expectedHeader = `v1,${expected}`;

  // signature header may contain multiple "v1,..." entries — match any
  return signature.split(" ").some((s) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedHeader));
    } catch {
      return false;
    }
  });
}

const STATUS_MAP: Record<string, { status: string; tsField?: string }> = {
  "email.sent": { status: "SENT", tsField: "sentAt" },
  "email.delivered": { status: "DELIVERED", tsField: "deliveredAt" },
  "email.opened": { status: "OPENED", tsField: "openedAt" },
  "email.clicked": { status: "CLICKED", tsField: "clickedAt" },
  "email.bounced": { status: "BOUNCED" },
  "email.complained": { status: "COMPLAINED" },
  "email.failed": { status: "FAILED" },
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySvixSignature(raw, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { type?: string; data?: { email_id?: string; reason?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.type;
  const providerMessageId = body.data?.email_id;
  if (!eventType || !providerMessageId) {
    return NextResponse.json({ ok: false, skipped: "missing-data" });
  }

  const mapping = STATUS_MAP[eventType];
  if (!mapping) return NextResponse.json({ ok: true, ignored: eventType });

  // Feed the suppression list for hard bounces and complaints.
  const bounce = (body.data as Record<string, unknown> | undefined)?.bounce as { type?: string } | undefined;
  const suppressReason = decideSuppression(eventType, bounce);
  if (suppressReason) {
    const toValues: string[] = Array.isArray((body.data as Record<string, unknown>)?.to)
      ? ((body.data as Record<string, unknown>).to as string[])
      : (body.data as Record<string, unknown>)?.to
      ? [String((body.data as Record<string, unknown>).to)]
      : [];
    for (const addr of toValues) {
      await addEmailSuppression(addr, suppressReason, "resend-webhook").catch(() => undefined);
    }
  }

  const msg = await prisma.emailMessage.findFirst({
    where: { providerMessageId },
    select: { id: true, status: true },
  });
  if (!msg) return NextResponse.json({ ok: true, skipped: "not-found" });

  // Don't downgrade a CLICKED/OPENED back to DELIVERED
  const RANK: Record<string, number> = {
    QUEUED: 0, SENT: 1, DELIVERED: 2, OPENED: 3, CLICKED: 4,
    BOUNCED: 5, COMPLAINED: 5, FAILED: 5,
  };
  if (RANK[mapping.status] < RANK[msg.status]) {
    return NextResponse.json({ ok: true, skipped: "lower-rank" });
  }

  const update: Record<string, unknown> = { status: mapping.status };
  if (mapping.tsField) update[mapping.tsField] = new Date();
  if (eventType === "email.bounced") update.errorReason = body.data?.reason ?? "bounced";
  if (eventType === "email.failed") update.errorReason = body.data?.reason ?? "failed";

  await prisma.emailMessage.update({
    where: { id: msg.id },
    data: update,
  });

  return NextResponse.json({ ok: true });
}
