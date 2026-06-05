/**
 * Seeds the standard debt-settlement email templates into EmailTemplate.
 * Idempotent: upsert by developerName.
 *
 * Run via: POST /api/admin/seed-email-templates (gated by admin)
 * Or call from prisma/seed.ts.
 */

import { prisma } from "@/lib/prisma";

interface TemplateSeed {
  developerName: string;
  name: string;
  folder: string;
  subject: string;
  bodyHtml: string;
  description: string;
}

const STD_FOOTER = `
<hr style="border:0;border-top:1px solid #e4e6eb;margin:24px 0">
<p style="font-size:12px;color:#65676b;line-height:1.5">
  Coastal Debt Resolve · 1-866-COASTAL · support@coastaldebt.com<br>
  This email was sent to {{email}}. Reply to this message to reach your specialist directly.
</p>
`;

const TEMPLATES: TemplateSeed[] = [
  {
    developerName: "welcome_enrollment",
    name: "Welcome — Enrollment Confirmation",
    folder: "Onboarding",
    description: "Sent immediately after the client signs the program agreement.",
    subject: "Welcome to Coastal Debt, {{firstName}} — you're enrolled",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Welcome to Coastal Debt. Your enrollment for <strong>{{businessName}}</strong> is complete and your program is officially in motion.</p>
<p><strong>What happens next:</strong></p>
<ol>
  <li>Your dedicated specialist <strong>{{ownerName}}</strong> will reach out within 1 business day.</li>
  <li>Your first deposit will pull on the scheduled date you confirmed.</li>
  <li>We'll start negotiating with your creditors as soon as your account is funded.</li>
</ol>
<p>You can reply to this email any time to reach your specialist directly.</p>
<p>Talk soon,<br>{{ownerName}}<br>Coastal Debt</p>
${STD_FOOTER}`,
  },
  {
    developerName: "contract_sent",
    name: "Contract — Sent for Signature",
    folder: "Onboarding",
    description: "Sent when an envelope is dispatched for the client to sign.",
    subject: "Action required: please sign your Coastal Debt agreement",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Your program agreement for <strong>{{businessName}}</strong> is ready to sign.</p>
<p style="margin:24px 0">
  <a href="{{envelopeUrl}}" style="background:#0070d2;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:600">Review & Sign</a>
</p>
<p>The link is unique to you. Once signed, your enrollment locks in and we begin work with your creditors.</p>
<p>Questions? Reply here or call your specialist <strong>{{ownerName}}</strong>.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "first_payment_confirmation",
    name: "Payment — First Deposit Confirmed",
    folder: "Payments",
    description: "Sent after the first scheduled draft clears.",
    subject: "Your first deposit cleared — {{businessName}}",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Great news — your first deposit just cleared. Your dedicated reserve account is now funded.</p>
<p><strong>What's next:</strong> Our negotiation team starts contacting your creditors today. You'll hear from us as soon as we have a settlement offer to review.</p>
<p>Your specialist: <strong>{{ownerName}}</strong></p>
${STD_FOOTER}`,
  },
  {
    developerName: "payment_reminder_upcoming",
    name: "Payment — Upcoming Reminder",
    folder: "Payments",
    description: "Reminder sent 3 days before a scheduled draft.",
    subject: "Heads up: next deposit on {{nextDraftDate}}",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>This is a friendly reminder that your next deposit is scheduled for <strong>{{nextDraftDate}}</strong>.</p>
<p>Need to reschedule? Reply to this email at least 2 business days in advance.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "payment_failed_nsf",
    name: "Payment — Failed (NSF)",
    folder: "Payments",
    description: "Sent when a draft returns NSF.",
    subject: "Action required: your deposit didn't go through",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Your scheduled deposit on <strong>{{lastDraftDate}}</strong> was returned by your bank.</p>
<p>To keep your program on track, please reply to this email or call <strong>{{ownerName}}</strong> at 1-866-COASTAL so we can reschedule the deposit.</p>
<p>If we don't hear from you within 5 business days, your account may be paused.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "settlement_offer_received",
    name: "Settlement — Offer Received",
    folder: "Settlements",
    description: "Sent when a creditor offer arrives and needs client review.",
    subject: "New settlement offer ready for your review",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>We received a settlement offer on one of your accounts. <strong>{{ownerName}}</strong> will call you shortly to walk you through it.</p>
<p>If approved, your dedicated reserve will fund the settlement.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "settlement_accepted",
    name: "Settlement — Accepted by Creditor",
    folder: "Settlements",
    description: "Sent when a creditor accepts a settlement offer.",
    subject: "Settlement accepted — congratulations, {{firstName}}",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>One of your creditors just accepted our settlement offer. This is a big milestone.</p>
<p>Funds will release from your reserve account on the agreed payment date. You'll receive a confirmation when the payment posts.</p>
<p>Keep going — we're making real progress.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "settlement_completed",
    name: "Settlement — Payment Sent",
    folder: "Settlements",
    description: "Sent when settlement payment is wired to the creditor.",
    subject: "Settlement payment sent — {{businessName}}",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>The settlement payment for your account with the creditor cleared today. That balance is now resolved.</p>
<p>You'll see a satisfaction letter or zero-balance statement from the creditor within 30 days. Keep it for your records.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "bank_change_request",
    name: "Bank Change — Confirmation",
    folder: "Account",
    description: "Confirms a bank account update on the client's profile.",
    subject: "Your banking information has been updated",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>We updated the bank account on file for your Coastal Debt program. Future deposits will draft from the new account starting on the next scheduled date.</p>
<p>If you didn't request this change, reply immediately to <strong>{{ownerName}}</strong>.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "skip_payment_confirmation",
    name: "Skip Payment — Confirmation",
    folder: "Payments",
    description: "Confirms an approved skip-payment request.",
    subject: "Your skip payment is approved",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Your skip-payment request for the deposit on <strong>{{skipDate}}</strong> is approved.</p>
<p>Your next scheduled deposit will resume on <strong>{{nextDraftDate}}</strong>. Note: skipping a deposit may extend your overall program length.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "account_suspended",
    name: "Account — Suspended",
    folder: "Account",
    description: "Sent when an account is moved to Suspended status.",
    subject: "Important: your account is currently on hold",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Your Coastal Debt account is currently on hold. We've paused communications with your creditors until we hear back from you.</p>
<p>Please call <strong>{{ownerName}}</strong> at 1-866-COASTAL or reply to this email today so we can reactivate your program.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "cancellation_confirmation",
    name: "Account — Cancellation Confirmed",
    folder: "Account",
    description: "Sent when a client cancels the program.",
    subject: "Your Coastal Debt program has been cancelled",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>We've processed your cancellation request. As of today, no further deposits will be drafted and we've stopped negotiations.</p>
<p>Any funds remaining in your reserve account, minus earned fees, will be refunded within 10 business days.</p>
<p>If you change your mind or have questions, your specialist <strong>{{ownerName}}</strong> is here.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "graduation",
    name: "Graduation — Program Complete",
    folder: "Account",
    description: "Sent when all accounts are settled and the program is complete.",
    subject: "Congratulations — you graduated from Coastal Debt 🎉",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>You did it. Every account in your Coastal Debt program is now resolved.</p>
<p>This is a real accomplishment — you took control of your debt and saw it through. We're proud to have walked it with you.</p>
<p>If you ever need us again, you know where to find us.</p>
<p>— The Coastal Debt team</p>
${STD_FOOTER}`,
  },
  {
    developerName: "welcome_call_scheduled",
    name: "Welcome Call — Scheduled",
    folder: "Onboarding",
    description: "Sent after a welcome call is booked.",
    subject: "Your welcome call is confirmed for {{appointmentTime}}",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Your welcome call with <strong>{{ownerName}}</strong> is confirmed for <strong>{{appointmentTime}}</strong>.</p>
<p>We'll review your enrollment, answer any questions, and walk you through the first 60 days of the program.</p>
<p>Need to reschedule? Reply here.</p>
${STD_FOOTER}`,
  },
  {
    developerName: "callback_requested",
    name: "Lead — Callback Requested",
    folder: "Lead",
    description: "Auto-reply when a lead requests a callback from the web form.",
    subject: "Thanks for reaching out, {{firstName}} — we'll call you back",
    bodyHtml: `
<p>Hi {{firstName}},</p>
<p>Thanks for reaching out to Coastal Debt. A specialist will call you back at <strong>{{phone}}</strong> within one business hour.</p>
<p>If you'd rather not wait, you can call us at 1-866-COASTAL.</p>
${STD_FOOTER}`,
  },
];

export async function seedEmailTemplates(): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;
  for (const t of TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({ where: { developerName: t.developerName } });
    if (existing) {
      await prisma.emailTemplate.update({
        where: { developerName: t.developerName },
        data: {
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          folder: t.folder,
          description: t.description,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.emailTemplate.create({
        data: {
          developerName: t.developerName,
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          folder: t.folder,
          description: t.description,
          isActive: true,
        },
      });
      created++;
    }
  }
  return { created, updated, total: TEMPLATES.length };
}
