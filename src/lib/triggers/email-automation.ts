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

/**
 * Lead status changed.
 *
 * Auto welcome-on-convert email DISABLED 2026-06-24 per request — converting a
 * lead no longer sends the "you're enrolled" email automatically; reps send the
 * welcome manually. To re-enable, restore the queueAndSend({ template:
 * "welcome_enrollment", ... }) for newStatus === "Converted".
 */
export async function onLeadStatusChange(
  _leadId: string,
  _oldStatus: string,
  _newStatus: string,
): Promise<void> {
  return;
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
