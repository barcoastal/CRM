/**
 * Outbound email sender. Drains the QUEUED EmailMessage queue and sends via
 * Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Provider abstraction: a single send(...) function so we can later add
 * SendGrid / Mailgun / SES without touching callers.
 *
 * Env:
 *   RESEND_API_KEY=re_xxx
 *   EMAIL_FROM="Coastal Debt <no-reply@coastaldebt.com>"  (default From, can be overridden per-message)
 *   EMAIL_REPLY_TO="support@coastaldebt.com"              (optional default Reply-To)
 *
 * Template merge: replaces {{field}} tokens in subject + bodyHtml + bodyText
 * with values from the related Lead / Opportunity / Account / Contact /
 * EmailTemplate-supplied vars. Tokens that don't resolve become empty string.
 */

import { prisma } from "@/lib/prisma";
import type { EmailMessage } from "@/generated/prisma/client";
import {
  loadResendAttachmentsForTemplate,
  type ResendAttachment,
} from "@/lib/email/template-attachments";

interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

async function sendViaResend(args: {
  from: string;
  to: string[];
  cc?: string[] | null;
  bcc?: string[] | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
  headers?: Record<string, string> | null;
  attachments?: ResendAttachment[] | null;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const body: Record<string, unknown> = {
    from: args.from,
    to: args.to,
    subject: args.subject,
  };
  if (args.html) body.html = args.html;
  if (args.text) body.text = args.text;
  if (args.cc && args.cc.length > 0) body.cc = args.cc;
  if (args.bcc && args.bcc.length > 0) body.bcc = args.bcc;
  if (args.replyTo) body.reply_to = args.replyTo;
  if (args.headers && Object.keys(args.headers).length > 0) body.headers = args.headers;
  if (args.attachments && args.attachments.length > 0) body.attachments = args.attachments;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    return { ok: true, providerMessageId: data.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Apply {{token}} merge against a plain object map. */
export function mergeTokens(template: string | null | undefined, vars: Record<string, string | number | null | undefined>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

/** Build the variables map for one EmailMessage from its related entities. */
async function buildMergeVars(msg: EmailMessage): Promise<Record<string, string | number | null>> {
  const vars: Record<string, string | number | null> = {};

  if (msg.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: msg.leadId },
      include: { assignedTo: { select: { name: true, email: true } } },
    });
    if (lead) {
      vars.firstName = lead.contactName?.split(" ")[0] ?? "";
      vars.lastName = lead.contactName?.split(" ").slice(1).join(" ") ?? "";
      vars.contactName = lead.contactName;
      vars.businessName = lead.businessName;
      vars.email = lead.email ?? "";
      vars.phone = lead.phone;
      vars.totalDebt = lead.totalDebtEst ?? 0;
      vars.ownerName = lead.assignedTo?.name ?? "";
      vars.ownerEmail = lead.assignedTo?.email ?? "";
    }
  }
  if (msg.opportunityId) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: msg.opportunityId },
      include: {
        account: { select: { name: true } },
        primaryContact: { select: { fullName: true, firstName: true, lastName: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    });
    if (opp) {
      vars.opportunityName = opp.name ?? "";
      vars.opportunityStage = opp.stage;
      vars.accountName = opp.account?.name ?? vars.accountName ?? "";
      vars.contactName = opp.primaryContact?.fullName ?? vars.contactName ?? "";
      vars.firstName = opp.primaryContact?.firstName ?? vars.firstName ?? "";
      vars.lastName = opp.primaryContact?.lastName ?? vars.lastName ?? "";
      vars.ownerName = opp.assignedTo?.name ?? vars.ownerName ?? "";
      vars.ownerEmail = opp.assignedTo?.email ?? vars.ownerEmail ?? "";
    }
  }
  if (msg.accountId) {
    const account = await prisma.account.findUnique({
      where: { id: msg.accountId },
      include: { owner: { select: { name: true, email: true } } },
    });
    if (account) {
      vars.accountName = account.name;
      vars.accountEmail = account.email ?? "";
      vars.accountPhone = account.phone ?? "";
      vars.escrowBalance = account.escrowBalance;
      vars.ownerName = account.owner?.name ?? vars.ownerName ?? "";
      vars.ownerEmail = account.owner?.email ?? vars.ownerEmail ?? "";
    }
  }
  return vars;
}

/** Render a single EmailMessage — pulls its template (if any) and merges tokens. */
export async function renderEmail(msg: EmailMessage): Promise<{ subject: string; html?: string; text?: string }> {
  const vars = await buildMergeVars(msg);

  let subject = msg.subject;
  let html = msg.bodyHtml ?? undefined;
  let text = msg.bodyText ?? undefined;

  if (msg.templateId) {
    const template = await prisma.emailTemplate.findUnique({ where: { id: msg.templateId } });
    if (template) {
      subject = template.subject || msg.subject;
      html = template.bodyHtml ?? html;
      text = template.bodyText ?? text;
    }
  }

  return {
    subject: mergeTokens(subject, vars),
    html: html ? mergeTokens(html, vars) : undefined,
    text: text ? mergeTokens(text, vars) : undefined,
  };
}

function splitCsv(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
}

/** Send a single EmailMessage; updates its status + providerMessageId in place. */
export async function sendQueuedEmail(msgId: string): Promise<SendResult> {
  const msg = await prisma.emailMessage.findUnique({ where: { id: msgId } });
  if (!msg) return { ok: false, error: "Not found" };
  if (msg.status === "SENT" || msg.status === "DELIVERED") {
    return { ok: true, providerMessageId: msg.providerMessageId ?? undefined };
  }
  if (msg.direction !== "OUTBOUND") return { ok: false, error: "Not outbound" };

  const rendered = await renderEmail(msg);
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const replyTo = process.env.EMAIL_REPLY_TO ?? null;

  // Pull template attachments (if any) so they ride along with this send.
  const attachments = await loadResendAttachmentsForTemplate(msg.templateId);

  const result = await sendViaResend({
    from: msg.fromAddress || defaultFrom,
    to: splitCsv(msg.toAddresses),
    cc: splitCsv(msg.cc),
    bcc: splitCsv(msg.bcc),
    subject: rendered.subject,
    html: rendered.html ?? null,
    text: rendered.text ?? null,
    replyTo,
    // inReplyTo is stored without angle brackets; RFC 5322 requires them.
    headers: msg.inReplyTo
      ? { "In-Reply-To": `<${msg.inReplyTo}>`, References: `<${msg.inReplyTo}>` }
      : null,
    attachments,
  });

  await prisma.emailMessage.update({
    where: { id: msgId },
    data: result.ok
      ? {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          provider: "RESEND",
          bodyText: rendered.text ?? msg.bodyText,
          bodyHtml: rendered.html ?? msg.bodyHtml,
          subject: rendered.subject,
        }
      : {
          status: "FAILED",
          errorReason: result.error ?? "send failed",
        },
  });

  return result;
}

/** Drain up to `limit` QUEUED OUTBOUND emails. Called by the cron. */
export async function drainEmailQueue(limit = 25): Promise<{ sent: number; failed: number }> {
  const queue = await prisma.emailMessage.findMany({
    where: { status: "QUEUED", direction: "OUTBOUND" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of queue) {
    const r = await sendQueuedEmail(id);
    if (r.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}
