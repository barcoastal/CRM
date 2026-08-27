import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSmsNow } from "@/lib/sms-sender";

/**
 * Cron-driven pre-call SMS reminders. Hit every few minutes (same secret as the
 * SMS send-queue). Texts each upcoming booked call once, ~30 min before its
 * time, then stamps smsRemindedAt so it never double-sends.
 *   POST /api/sms/booking-reminders
 *   Header: x-sms-secret: <SMS_SEND_SECRET>
 */
export async function POST(request: NextRequest) {
  const required = process.env.SMS_SEND_SECRET;
  if (required) {
    const got = request.headers.get("x-sms-secret") ?? new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 30 * 60000);
  const due = await prisma.scheduledCall.findMany({
    where: {
      status: { in: ["REQUESTED", "ASSIGNED"] },
      smsRemindedAt: null,
      requestedAt: { gte: now, lte: windowEnd },
    },
    take: 100,
  });

  let sent = 0;
  for (const call of due) {
    const to = call.clientSmsPhone ?? call.clientPhone;
    if (!to || !call.requestedAt) {
      await prisma.scheduledCall.update({ where: { id: call.id }, data: { smsRemindedAt: now } }).catch(() => undefined);
      continue;
    }
    const t = call.requestedAt.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    const r = await sendSmsNow({
      to,
      body: `Coastal Debt reminder: your call is at ${t} ET today. A specialist will call you shortly. Reply STOP to opt out.`,
      leadId: call.leadId, accountId: null,
    }).catch(() => ({ ok: false }));
    if (r.ok) sent++;
    await prisma.scheduledCall.update({ where: { id: call.id }, data: { smsRemindedAt: now } }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, considered: due.length, sent });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
