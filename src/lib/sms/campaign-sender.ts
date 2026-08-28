/**
 * Bulk-send an SmsCampaign: resolve its audience, create one OUTBOUND
 * SmsMessage per recipient (tagged with the campaign), send via SMS Magic, and
 * roll up sent/failed counts on the campaign.
 */
import { prisma } from "@/lib/prisma";
import { mergeTokens } from "@/lib/email-sender";
import { sendQueuedSms } from "@/lib/sms-sender";
import { resolveSmsAudience } from "@/lib/sms/audience";

export async function sendSmsCampaign(campaignId: string): Promise<{ ok: boolean; total: number; sent: number; failed: number; error?: string }> {
  const c = await prisma.smsCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return { ok: false, total: 0, sent: 0, failed: 0, error: "Campaign not found" };
  if (c.status === "SENDING" || c.status === "SENT") return { ok: false, total: c.total, sent: c.sent, failed: c.failed, error: "Already sent" };

  const recipients = await resolveSmsAudience({ entity: c.entity === "Contact" ? "Contact" : "Lead", segmentId: c.segmentId });
  await prisma.smsCampaign.update({ where: { id: c.id }, data: { status: "SENDING", total: recipients.length } });

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      const body = mergeTokens(c.body, r.vars);
      const hasUnicode = /[^\x00-\x7F]/.test(body);
      const segments = Math.max(1, Math.ceil(body.length / (hasUnicode ? 70 : 160)));
      const row = await prisma.smsMessage.create({
        data: {
          direction: "OUTBOUND", status: "QUEUED", provider: "SMS_MAGIC",
          toNumber: r.phone, fromNumber: process.env.SMS_MAGIC_SENDER_ID ?? "", body, segments,
          smsCampaignId: c.id, leadId: r.leadId ?? null, contactId: r.contactId ?? null, accountId: r.accountId ?? null,
        },
        select: { id: true },
      });
      const res = await sendQueuedSms(row.id);
      if (res.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  await prisma.smsCampaign.update({
    where: { id: c.id },
    data: { status: "SENT", sent, failed, sentAt: new Date() },
  });
  return { ok: true, total: recipients.length, sent, failed };
}
