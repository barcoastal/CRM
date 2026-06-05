/**
 * Lifecycle email automation. Fires a templated email when a tracked
 * status transition happens. Called from individual entity triggers.
 *
 * Each rule maps (entity, condition) → template developerName.
 * The email is queued via /api/emails/compose (sendNow=true) so it goes
 * out immediately through Resend.
 */

import { prisma } from "@/lib/prisma";
import { sendQueuedEmail } from "@/lib/email-sender";

interface TriggerContext {
  template: string;
  to: string | null;
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
}

async function queueAndSend(ctx: TriggerContext): Promise<void> {
  if (!ctx.to) return; // no email on file, skip silently
  if (!ctx.template) return;

  const template = await prisma.emailTemplate.findUnique({
    where: { developerName: ctx.template },
  });
  if (!template || !template.isActive) return;

  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";

  const msg = await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND",
      status: "QUEUED",
      fromAddress: defaultFrom,
      toAddresses: ctx.to,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      templateId: template.id,
      leadId: ctx.leadId ?? null,
      opportunityId: ctx.opportunityId ?? null,
      accountId: ctx.accountId ?? null,
      contactId: ctx.contactId ?? null,
    },
    select: { id: true },
  });

  // Fire-and-forget — failures land in EmailMessage.errorReason for review
  void sendQueuedEmail(msg.id).catch(() => undefined);
}

/** Lead status changed — fire welcome email when converted. */
export async function onLeadStatusChange(leadId: string, oldStatus: string, newStatus: string): Promise<void> {
  if (oldStatus === newStatus) return;
  if (newStatus !== "Converted") return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, convertedOpportunityId: true, convertedAccountId: true },
  });
  if (!lead?.email) return;

  await queueAndSend({
    template: "welcome_enrollment",
    to: lead.email,
    leadId,
    opportunityId: lead.convertedOpportunityId ?? undefined,
    accountId: lead.convertedAccountId ?? undefined,
  });
}

/** Account stage changed — fire status-driven emails. */
export async function onAccountStageChange(accountId: string, oldStage: string, newStage: string): Promise<void> {
  if (oldStage === newStage) return;

  const STAGE_TO_TEMPLATE: Record<string, string> = {
    "Suspended": "account_suspended",
    "Cancelled": "cancellation_confirmation",
    "Graduated": "graduation",
  };
  const template = STAGE_TO_TEMPLATE[newStage];
  if (!template) return;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { email: true },
  });
  if (!account?.email) return;

  await queueAndSend({ template, to: account.email, accountId });
}

/** First payment cleared on an Account — fire confirmation. */
export async function onFirstPaymentCleared(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { email: true, firstContractSignedDate: true },
  });
  if (!account?.email) return;

  await queueAndSend({
    template: "first_payment_confirmation",
    to: account.email,
    accountId,
  });
}

/** Envelope sent for signature — email the link. */
export async function onEnvelopeSent(envelopeId: string, recipientEmail: string): Promise<void> {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    select: { accountId: true, opportunityId: true, leadId: true },
  });
  if (!envelope) return;

  await queueAndSend({
    template: "contract_sent",
    to: recipientEmail,
    leadId: envelope.leadId ?? undefined,
    opportunityId: envelope.opportunityId ?? undefined,
    accountId: envelope.accountId ?? undefined,
  });
}
