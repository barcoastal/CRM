/**
 * Mass-email sender. Drives one MassEmail blast: resolves recipients,
 * renders + instruments the body per recipient (open pixel + click rewrites),
 * sends via Resend, and persists one EmailMessage per send.
 *
 * Concurrency is capped (DEFAULT_CONCURRENCY) so we don't hammer Resend.
 * Per-recipient failures are caught + counted but do NOT abort the blast.
 *
 * This is invoked synchronously from the /send API for now (no queue). The
 * API returns once the blast finishes (or status flips to FAILED on hard error).
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { mergeTokens } from "@/lib/email-sender";
import {
  injectTrackingPixel,
  rewriteLinksForTracking,
  getTrackingBaseUrl,
} from "@/lib/email/tracking-rewrite";

const DEFAULT_CONCURRENCY = 5;

interface Recipient {
  entityType: "Lead" | "Contact";
  id: string;
  email: string;
  vars: Record<string, string | number | null>;
  leadId?: string;
  contactId?: string;
  accountId?: string;
}

function newTrackingId(): string {
  return randomBytes(12).toString("hex");
}

async function sendViaResend(args: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | null;
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const body: Record<string, unknown> = {
    from: args.from,
    to: [args.to],
    subject: args.subject,
  };
  if (args.html) body.html = args.html;
  if (args.text) body.text = args.text;
  if (args.replyTo) body.reply_to = args.replyTo;

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

async function loadLeadsAsRecipients(ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, email: { not: null } },
    select: {
      id: true,
      contactName: true,
      businessName: true,
      email: true,
      phone: true,
      totalDebtEst: true,
      assignedTo: { select: { name: true, email: true } },
    },
  });
  return leads
    .filter((l) => !!l.email)
    .map((l) => {
      const first = l.contactName?.split(" ")[0] ?? "";
      const last = l.contactName?.split(" ").slice(1).join(" ") ?? "";
      return {
        entityType: "Lead" as const,
        id: l.id,
        leadId: l.id,
        email: l.email!,
        vars: {
          firstName: first,
          lastName: last,
          contactName: l.contactName,
          businessName: l.businessName,
          email: l.email!,
          phone: l.phone,
          totalDebt: l.totalDebtEst ?? 0,
          ownerName: l.assignedTo?.name ?? "",
          ownerEmail: l.assignedTo?.email ?? "",
          accountName: l.businessName,
          leadName: l.contactName,
        },
      };
    });
}

async function loadContactsAsRecipients(ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids }, email: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      phone: true,
      primaryAccountId: true,
      primaryAccount: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  });
  return contacts
    .filter((c) => !!c.email)
    .map((c) => ({
      entityType: "Contact" as const,
      id: c.id,
      contactId: c.id,
      accountId: c.primaryAccountId ?? undefined,
      email: c.email!,
      vars: {
        firstName: c.firstName,
        lastName: c.lastName,
        contactName: c.fullName,
        businessName: c.primaryAccount?.name ?? "",
        accountName: c.primaryAccount?.name ?? "",
        email: c.email!,
        phone: c.phone,
        ownerName: c.owner?.name ?? "",
        ownerEmail: c.owner?.email ?? "",
        leadName: c.fullName,
      },
    }));
}

interface FilterCriteria {
  status?: string;
  source?: string;
  recordType?: string;
  state?: string;
  ownerId?: string;
  isActive?: boolean;
}

interface AudienceFilter {
  entityType?: "Lead" | "Contact";
  filters?: FilterCriteria;
}

async function resolveRecipientsByFilter(filter: AudienceFilter, limit = 5000): Promise<Recipient[]> {
  const entityType = filter.entityType ?? "Lead";
  const f = filter.filters ?? {};
  if (entityType === "Lead") {
    const leads = await prisma.lead.findMany({
      where: {
        email: { not: null },
        ...(f.status ? { status: f.status } : {}),
        ...(f.source ? { source: f.source } : {}),
        ...(f.recordType ? { recordType: f.recordType } : {}),
        ...(f.state ? { state: f.state } : {}),
        ...(f.ownerId ? { assignedToId: f.ownerId } : {}),
      },
      select: { id: true },
      take: limit,
    });
    return loadLeadsAsRecipients(leads.map((x) => x.id));
  }
  const contacts = await prisma.contact.findMany({
    where: {
      email: { not: null },
      ...(f.isActive === undefined ? { isActive: true } : { isActive: f.isActive }),
      ...(f.ownerId ? { ownerId: f.ownerId } : {}),
    },
    select: { id: true },
    take: limit,
  });
  return loadContactsAsRecipients(contacts.map((x) => x.id));
}

export async function resolveAudience(
  audienceType: string,
  audienceFilter: AudienceFilter,
  audienceIds: string[],
): Promise<Recipient[]> {
  if (audienceType === "list") {
    const entityType = audienceFilter.entityType ?? "Lead";
    if (entityType === "Lead") return loadLeadsAsRecipients(audienceIds);
    return loadContactsAsRecipients(audienceIds);
  }
  return resolveRecipientsByFilter(audienceFilter);
}

export async function countAudience(
  audienceType: string,
  audienceFilter: AudienceFilter,
  audienceIds: string[],
): Promise<number> {
  if (audienceType === "list") {
    const entityType = audienceFilter.entityType ?? "Lead";
    const ids = audienceIds;
    if (entityType === "Lead") {
      return prisma.lead.count({ where: { id: { in: ids }, email: { not: null } } });
    }
    return prisma.contact.count({ where: { id: { in: ids }, email: { not: null } } });
  }
  const entityType = audienceFilter.entityType ?? "Lead";
  const f = audienceFilter.filters ?? {};
  if (entityType === "Lead") {
    return prisma.lead.count({
      where: {
        email: { not: null },
        ...(f.status ? { status: f.status } : {}),
        ...(f.source ? { source: f.source } : {}),
        ...(f.recordType ? { recordType: f.recordType } : {}),
        ...(f.state ? { state: f.state } : {}),
        ...(f.ownerId ? { assignedToId: f.ownerId } : {}),
      },
    });
  }
  return prisma.contact.count({
    where: {
      email: { not: null },
      ...(f.isActive === undefined ? { isActive: true } : { isActive: f.isActive }),
      ...(f.ownerId ? { ownerId: f.ownerId } : {}),
    },
  });
}

/** Render the template body for one recipient: merge tokens → rewrite links → inject pixel. */
export function instrumentBody(
  bodyHtml: string | null | undefined,
  bodyText: string | null | undefined,
  subject: string,
  vars: Record<string, string | number | null>,
  trackingId: string,
  baseUrl: string,
): { subject: string; html?: string; text?: string } {
  const mergedSubject = mergeTokens(subject, vars);
  let html = bodyHtml ? mergeTokens(bodyHtml, vars) : undefined;
  if (html) {
    html = rewriteLinksForTracking(html, trackingId, baseUrl);
    html = injectTrackingPixel(html, trackingId, baseUrl);
  }
  const text = bodyText ? mergeTokens(bodyText, vars) : undefined;
  return { subject: mergedSubject, html, text };
}

/** Run with at most `limit` simultaneous workers. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function pull(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => pull());
  await Promise.all(runners);
  return results;
}

export async function startMassEmailJob(massEmailId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mass = await prisma.massEmail.findUnique({
      where: { id: massEmailId },
      include: {
        template: true,
        fromUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!mass) return { ok: false, error: "MassEmail not found" };
    if (!mass.template) return { ok: false, error: "Template missing" };

    const baseUrl = getTrackingBaseUrl();
    const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
    const replyTo = process.env.EMAIL_REPLY_TO ?? null;
    const fromAddress = mass.fromUser?.email
      ? `${mass.fromUser.name ?? mass.fromUser.email} <${mass.fromUser.email}>`
      : defaultFrom;

    const audienceFilter = (mass.audienceFilter ?? {}) as AudienceFilter;
    const recipients = await resolveAudience(mass.audienceType, audienceFilter, mass.audienceIds);

    await prisma.massEmail.update({
      where: { id: massEmailId },
      data: { status: "SENDING", totalCount: recipients.length },
    });

    let sent = 0;
    let failed = 0;

    await runWithConcurrency(recipients, DEFAULT_CONCURRENCY, async (r) => {
      const trackingId = newTrackingId();
      try {
        const rendered = instrumentBody(
          mass.template!.bodyHtml,
          mass.template!.bodyText,
          mass.template!.subject,
          r.vars,
          trackingId,
          baseUrl,
        );

        const result = await sendViaResend({
          from: fromAddress,
          to: r.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          replyTo,
        });

        await prisma.emailMessage.create({
          data: {
            direction: "OUTBOUND",
            status: result.ok ? "SENT" : "FAILED",
            fromAddress,
            toAddresses: r.email,
            subject: rendered.subject,
            bodyHtml: rendered.html ?? null,
            bodyText: rendered.text ?? null,
            templateId: mass.templateId,
            leadId: r.leadId ?? null,
            contactId: r.contactId ?? null,
            accountId: r.accountId ?? null,
            ownerId: mass.fromUserId ?? mass.createdById,
            provider: "RESEND",
            providerMessageId: result.providerMessageId ?? null,
            errorReason: result.ok ? null : result.error ?? "send failed",
            sentAt: result.ok ? new Date() : null,
            massEmailId,
            trackingId,
          },
        });

        if (result.ok) sent++;
        else failed++;
      } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : "unknown error";
        try {
          await prisma.emailMessage.create({
            data: {
              direction: "OUTBOUND",
              status: "FAILED",
              fromAddress,
              toAddresses: r.email,
              subject: mass.template!.subject,
              templateId: mass.templateId,
              leadId: r.leadId ?? null,
              contactId: r.contactId ?? null,
              accountId: r.accountId ?? null,
              ownerId: mass.fromUserId ?? mass.createdById,
              provider: "RESEND",
              errorReason: msg,
              massEmailId,
              trackingId,
            },
          });
        } catch {
          // swallow — counters still updated
        }
      }
    });

    await prisma.massEmail.update({
      where: { id: massEmailId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount: sent,
        failedCount: failed,
      },
    });
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    try {
      await prisma.massEmail.update({
        where: { id: massEmailId },
        data: { status: "FAILED" },
      });
    } catch {
      // ignore
    }
    return { ok: false, error: msg };
  }
}
